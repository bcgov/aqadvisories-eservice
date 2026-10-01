let app
var request = require('supertest')
var parallel = require('async/parallel')

async function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

beforeAll((done) => {
  require('../../server/server.js')(function (err, data) {
    app = data
    done()
  })
})

describe('GET /notifications', function () {
  var data
  beforeEach(async function () {
    data = await parallel([
      function (cb) {
        app.models.Notification.create(
          {
            channel: 'inApp',
            isBroadcast: true,
            message: {
              title: 'test',
              body: 'this is a test',
            },
            serviceName: 'myService',
            validTill: '2000-01-01',
            state: 'new',
          },
          cb
        )
      },
      function (cb) {
        app.models.Notification.create(
          {
            channel: 'inApp',
            isBroadcast: true,
            message: {
              title: 'test',
              body: 'this is a test',
            },
            serviceName: 'myService',
            readBy: ['bar'],
            state: 'new',
          },
          cb
        )
      },
      function (cb) {
        app.models.Notification.create(
          {
            channel: 'inApp',
            isBroadcast: true,
            message: {
              title: 'test',
              body: 'this is a test',
            },
            serviceName: 'myService',
            deletedBy: ['bar'],
            state: 'new',
          },
          cb
        )
      },
      function (cb) {
        app.models.Notification.create(
          {
            channel: 'inApp',
            isBroadcast: true,
            message: {
              title: 'test',
              body: 'this is a test',
            },
            serviceName: 'myService',
            invalidBefore: '3017-05-30',
            state: 'new',
          },
          cb
        )
      },
      function (cb) {
        app.models.Notification.create(
          {
            channel: 'email',
            isBroadcast: true,
            message: {
              from: 'no_reply@invlid.local',
              subject: 'hello',
              htmlBody: 'hello',
            },
            serviceName: 'myService',
            state: 'sent',
          },
          cb
        )
      },
    ])
  })

  it('should be forbidden by anonymous user', async function () {
    let res = await request(app).get('/api/notifications')
    expect(res.statusCode).toBe(403)
  })

  it('should be allowed to sm user for current, non-expired, non-deleted inApp notifications', async function () {
    let res = await request(app)
      .get('/api/notifications')
      .set('Accept', 'application/json')
      .set('SM_USER', 'bar')
    expect(res.statusCode).toBe(200)
    expect(res.body.length).toBe(1)
  })
})
describe('POST /notifications', function () {
  beforeEach(async function () {
    data = await parallel([
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myService',
            channel: 'email',
            userId: 'bar',
            userChannelId: 'bar@foo.com',
            state: 'confirmed',
            confirmationRequest: {
              confirmationCodeRegex: '\\d{5}',
              sendRequest: true,
              from: 'no_reply@invlid.local',
              subject: 'Subscription confirmation',
              textBody: 'enter {confirmation_code} in this email',
              confirmationCode: '12345',
            },
            unsubscriptionCode: '54321',
          },
          cb
        )
      },
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myService',
            channel: 'sms',
            userChannelId: '12345',
            state: 'confirmed',
          },
          cb
        )
      },
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myChunkedBroadcastService',
            channel: 'email',
            userChannelId: 'bar1@foo.com',
            state: 'confirmed',
          },
          cb
        )
      },
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myChunkedBroadcastService',
            channel: 'email',
            userChannelId: 'bar2@invalid',
            state: 'confirmed',
          },
          cb
        )
      },
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myFilterableBroadcastService',
            channel: 'email',
            userChannelId: 'bar2@invalid',
            state: 'confirmed',
            broadcastPushNotificationFilter: "contains(name,'f')",
          },
          cb
        )
      },
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myInvalideEmailService',
            channel: 'email',
            userChannelId: 'bar@invalid.local',
            state: 'confirmed',
          },
          cb
        )
      },
    ])
  })

  it('should send broadcast email notifications with proper mail merge', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody:
            '{1}, This is a broadcast test {confirmation_code} {service_name} {http_host} {rest_api_root} {subscription_id} {unsubscription_code} {2} {1}',
          htmlBody:
            '{1}, This is a broadcast test {confirmation_code} {service_name} {http_host} {rest_api_root} {subscription_id} {unsubscription_code} {2} {1}',
        },
        data: {
          '1': 'foo',
          '2': 'bar',
        },
        channel: 'email',
        isBroadcast: true,
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Notification.sendEmail).toHaveBeenCalled()
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].text
    ).not.toContain('{confirmation_code}')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].text
    ).not.toContain('{service_name}')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].text
    ).not.toContain('{http_host}')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].text
    ).not.toContain('{rest_api_root}')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].text
    ).not.toContain('{subscription_id}')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].text
    ).not.toContain('{unsubscription_code}')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].text
    ).toContain('12345')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].text
    ).toContain('myService')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].text
    ).toContain('http://127.0.0.1')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].text
    ).toContain('/api')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].text
    ).toContain('1 ')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].text
    ).toContain('54321')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].text
    ).toContain('bar foo')

    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].html
    ).not.toContain('{confirmation_code}')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].html
    ).not.toContain('{service_name}')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].html
    ).not.toContain('{http_host}')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].html
    ).not.toContain('{rest_api_root}')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].html
    ).not.toContain('{subscription_id}')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].html
    ).not.toContain('{unsubscription_code}')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].html
    ).toContain('12345')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].html
    ).toContain('myService')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].html
    ).toContain('http://127.0.0.1')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].html
    ).toContain('/api')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].html
    ).toContain('1 ')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].html
    ).toContain('54321')
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].text
    ).toContain('bar foo')
    // test list-unsubscribe header
    expect(
      app.models.Notification.sendEmail.calls
        .argsFor(0)[0]
        .list.unsubscribe[0].indexOf('un-1-54321@invalid.local')
    ).toBe(0)

    let data = await app.models.Notification.find({
      where: {
        serviceName: 'myService',
      },
    })
    expect(data.length).toBe(1)
  })

  it('should send unicast email notification', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody:
            'This is a unicast test {confirmation_code} {service_name} {http_host} {rest_api_root} {subscription_id} {unsubscription_code}',
          htmlBody:
            'This is a unicast test {confirmation_code} {service_name} {http_host} {rest_api_root} {subscription_id} {unsubscription_code}',
        },
        channel: 'email',
        userId: 'bar',
        userChannelId: 'bar@foo.COM',
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Notification.sendEmail).toHaveBeenCalled()
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'myService',
      },
    })
    expect(data.length).toBe(1)
  })

  it('should send unicast sms notification', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        message: {
          textBody:
            'This is a unicast test {confirmation_code} {service_name} {http_host} {rest_api_root} {subscription_id} {unsubscription_code}',
        },
        channel: 'sms',
        skipSubscriptionConfirmationCheck: true,
        userChannelId: '12345',
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Notification.sendSMS).toHaveBeenCalled()
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'myService',
      },
    })
    expect(data.length).toBe(1)
  })

  it('should send broadcast sms notification', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        message: {
          textBody:
            'This is a unicast test {confirmation_code} {service_name} {http_host} {rest_api_root} {subscription_id} {unsubscription_code}',
        },
        channel: 'sms',
        isBroadcast: true,
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Notification.sendSMS).toHaveBeenCalled()
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'myService',
      },
    })
    expect(data.length).toBe(1)
  })

  it('should not send future-dated notification', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody:
            'This is a unicast test {confirmation_code} {service_name} {http_host} {rest_api_root} {subscription_id} {unsubscription_code}',
        },
        channel: 'email',
        userId: 'bar',
        invalidBefore: '3017-06-01',
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Notification.sendEmail).not.toHaveBeenCalled()
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'myService',
      },
    })
    expect(data.length).toBe(1)
  })

  it('should deny skipSubscriptionConfirmationCheck unicast notification missing userChannelId', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody:
            'This is a unicast test {confirmation_code} {service_name} {http_host} {rest_api_root} {subscription_id} {unsubscription_code}',
        },
        channel: 'email',
        userId: 'bar',
        skipSubscriptionConfirmationCheck: true,
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(403)
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'myService',
      },
    })
    expect(data.length).toBe(0)
  })

  it('should deny unicast notification missing both userChannelId and userId', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody:
            'This is a unicast test {confirmation_code} {service_name} {http_host} {rest_api_root} {subscription_id} {unsubscription_code}',
        },
        channel: 'email',
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(403)
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'myService',
      },
    })
    expect(data.length).toBe(0)
  })

  it('should deny anonymous user', async function () {
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody: 'This is a broadcast test',
        },
        channel: 'email',
        isBroadcast: true,
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(403)
  })
  it('should deny sm user', async function () {
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody: 'This is a broadcast test',
        },
        channel: 'email',
        isBroadcast: true,
      })
      .set('Accept', 'application/json')
      .set('SM_USER', 'bar')
    expect(res.statusCode).toBe(403)
  })

  it('should perform async callback for broadcast push notification if asyncBroadcastPushNotification is set', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    app.models.Notification.sendEmail = jasmine
      .createSpy()
      .and.callFake(function () {
        let cb = arguments[arguments.length - 1]
        console.log('faking delayed sendEmail')
        setTimeout(function () {
          return cb(null, null)
        }, 1000)
      })
    spyOn(app.models.Notification.request, 'post')

    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody:
            'This is a unicast test {confirmation_code} {service_name} {http_host} {rest_api_root} {subscription_id} {unsubscription_code}',
        },
        channel: 'email',
        isBroadcast: true,
        asyncBroadcastPushNotification: 'http://foo.com',
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'myService',
      },
    })
    expect(data.length).toBe(1)
    expect(data[0].state).toBe('new')
    await wait(3000)
    data = await app.models.Notification.find({
      where: {
        serviceName: 'myService',
      },
    })
    expect(data.length).toBe(1)
    expect(data[0].state).toBe('sent')
    expect(app.models.Notification.request.post).toHaveBeenCalledWith(
      'http://foo.com',
      jasmine.any(Object),
      jasmine.any(Object)
    )
  })

  it('should send chunked sync broadcast email notifications', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    let realGet = app.models.Notification.app.get
    spyOn(app.models.Notification.app, 'get').and.callFake(function (param) {
      if (param === 'notification') {
        return {
          broadcastSubscriberChunkSize: 1,
          broadcastSubRequestBatchSize: 10,
        }
      } else {
        return realGet.call(app, param)
      }
    })

    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myChunkedBroadcastService',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody: 'test',
        },
        channel: 'email',
        isBroadcast: true,
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Notification.sendEmail).toHaveBeenCalledTimes(2)
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'myChunkedBroadcastService',
      },
    })
    expect(data.length).toBe(1)
  })

  it('should send chunked async broadcast email notifications', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    let realGet = app.models.Notification.app.get
    spyOn(app.models.Notification.app, 'get').and.callFake(function (param) {
      if (param === 'notification') {
        return {
          broadcastSubscriberChunkSize: 1,
          broadcastSubRequestBatchSize: 10,
        }
      } else {
        return realGet.call(app, param)
      }
    })
    spyOn(app.models.Notification.request, 'post')
    spyOn(app.models.Notification.request, 'get').and.callFake(async function (
      url
    ) {
      let uri = url.substring(url.indexOf('/api/notifications'))
      let response = await request(app)
        .get(uri)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
      response.data = response.body
      return response
    })
    app.models.Notification.sendEmail = jasmine
      .createSpy()
      .and.callFake(function () {
        let cb = arguments[arguments.length - 1]
        let to = arguments[0].to
        let error = null
        if (to.indexOf('invalid') >= 0) {
          error = to
        }
        console.log('faking sendEmail with error for invalid recipient')
        return cb(error, null)
      })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myChunkedBroadcastService',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody: 'test',
        },
        channel: 'email',
        isBroadcast: true,
        asyncBroadcastPushNotification: 'http://foo.com',
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'myChunkedBroadcastService',
      },
    })
    expect(data.length).toBe(1)
    expect(data[0].state).toBe('new')
    await wait(3000)
    data = await app.models.Notification.find({
      where: {
        serviceName: 'myChunkedBroadcastService',
      },
    })
    expect(data.length).toBe(1)
    expect(data[0].state).toBe('sent')
    expect(app.models.Notification.request.post).toHaveBeenCalledWith(
      'http://foo.com',
      jasmine.any(Object),
      jasmine.any(Object)
    )
    expect(app.models.Notification.sendEmail).toHaveBeenCalledTimes(2)
    expect(data[0].failedDispatches.length).toBe(1)
    expect(data[0].failedDispatches[0]).toEqual(
      jasmine.objectContaining({
        userChannelId: 'bar2@invalid',
        error: 'bar2@invalid',
      })
    )
  })

  it('should send broadcast email notification with matching filter', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myFilterableBroadcastService',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody: 'test',
        },
        data: {
          name: 'foo',
        },
        channel: 'email',
        isBroadcast: true,
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Notification.sendEmail).toHaveBeenCalledTimes(1)
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'myFilterableBroadcastService',
      },
    })
    expect(data.length).toBe(1)
  })

  it('should skip broadcast email notification with unmatching filter', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myFilterableBroadcastService',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody: 'test',
        },
        data: {
          name: 'Foo',
        },
        channel: 'email',
        isBroadcast: true,
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Notification.sendEmail).toHaveBeenCalledTimes(0)
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'myFilterableBroadcastService',
      },
    })
    expect(data.length).toBe(1)
    expect(data[0].state).toBe('sent')
  })

  xit('should unsubscribe recipients of invalid emails', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    app.models.Notification.sendEmail = jasmine
      .createSpy()
      .and.callFake(function () {
        let cb = arguments[arguments.length - 1]
        let to = arguments[0].to
        let error = null
        if (to.indexOf('invalid') >= 0) {
          error = {
            responseCode: 550,
          }
        }
        console.log('faking sendEmail with error for invalid recipient')
        return cb(error, null)
      })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myInvalideEmailService',
        message: {
          from: 'no_reply@invalid.local',
          subject: 'test',
          textBody: 'test',
        },
        channel: 'email',
        isBroadcast: true,
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'myInvalideEmailService',
      },
    })
    expect(data.length).toBe(1)
    expect(data[0].state).toBe('sent')
    expect(app.models.Notification.sendEmail).toHaveBeenCalledTimes(1)
    expect(data[0].failedDispatches.length).toBe(1)
    expect(data[0].failedDispatches[0]).toEqual(
      jasmine.objectContaining({
        userChannelId: 'bar@invalid.local',
        error: {
          responseCode: 550,
        },
      })
    )
    data = await app.models.Subscription.find({
      where: {
        serviceName: 'myInvalideEmailService',
      },
    })
    expect(data.length).toBe(1)
    expect(data[0].state).toBe('deleted')
  })

  xit('should unsubscribe recipients of invalid emails when sending async broadcast email notifications', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    let realGet = app.models.Notification.app.get
    spyOn(app.models.Notification.app, 'get').and.callFake(function (param) {
      if (param === 'notification') {
        return {
          broadcastSubscriberChunkSize: 100,
          broadcastSubRequestBatchSize: 10,
        }
      } else {
        return realGet.call(app, param)
      }
    })
    app.models.Notification.sendEmail = jasmine
      .createSpy()
      .and.callFake(function () {
        let cb = arguments[arguments.length - 1]
        let to = arguments[0].to
        let error = null
        if (to.indexOf('invalid') >= 0) {
          error = {
            responseCode: 550,
          }
        }
        console.log('faking sendEmail with error for invalid recipient')
        return cb(error, null)
      })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myInvalideEmailService',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody: 'test',
        },
        channel: 'email',
        isBroadcast: true,
        asyncBroadcastPushNotification: true,
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    await wait(3000)
    let data = await app.models.Subscription.find({
      where: {
        serviceName: 'myInvalideEmailService',
      },
    })
    expect(data.length).toBe(1)
    expect(data[0].state).toBe('deleted')
    expect(app.models.Notification.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('should update bounce record after sending unicast email notification', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    await app.models.Bounce.create({
      channel: 'email',
      userChannelId: 'bar@foo.com',
      hardBounceCount: 1,
      state: 'active',
    })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody: 'test',
        },
        channel: 'email',
        userId: 'bar',
        userChannelId: 'bar@foo.COM',
      })
      .set('Accept', 'application/json')
    let data = await app.models.Bounce.findById(1)
    expect(data.latestNotificationStarted).toBeDefined()
    expect(data.latestNotificationEnded).toBeDefined()
    expect(data.latestNotificationEnded).toBeGreaterThanOrEqual(
      data.latestNotificationStarted
    )
  })

  it('should update bounce record after sending broadcast email notification', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    await app.models.Bounce.create({
      channel: 'email',
      userChannelId: 'bar@foo.com',
      hardBounceCount: 1,
      state: 'active',
    })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        channel: 'email',
        message: {
          from: 'no_reply@local.invalid',
          subject: 'test',
          textBody: 'test',
        },
        isBroadcast: true,
      })
      .set('Accept', 'application/json')
    let data = await app.models.Bounce.findById(1)
    expect(data.latestNotificationStarted).toBeDefined()
    expect(data.latestNotificationEnded).toBeDefined()
    expect(data.latestNotificationEnded).toBeGreaterThanOrEqual(
      data.latestNotificationStarted
    )
  })

  it('should log successful dispatches after sending broadcast email notification if configured so', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    const realGet = app.models.Notification.app.get
    spyOn(app.models.Notification.app, 'get').and.callFake(function (param) {
      if (param === 'notification') {
        let val = Object.create(realGet.call(app, param))
        val.logSuccessfulBroadcastDispatches = true
        return val
      } else {
        return realGet.call(app, param)
      }
    })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        channel: 'email',
        message: {
          from: 'no_reply@local.invalid',
          subject: 'test',
          textBody: 'test',
        },
        isBroadcast: true,
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(res.body.successfulDispatches[0]).toEqual(1)
  })

  it('should not log successful dispatches after sending broadcast email notification if configured so', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        channel: 'email',
        message: {
          from: 'no_reply@local.invalid',
          subject: 'test',
          textBody: 'test',
        },
        isBroadcast: true,
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(res.body.successfulDispatches).toBeUndefined()
  })

  it('should set envelope address when bounce is enabled and inboundSmtpServer.domain is defined', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        channel: 'email',
        message: {
          from: 'no_reply@local.invalid',
          subject: 'test',
          textBody: 'test',
        },
        isBroadcast: true,
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].envelope.from
    ).toBe('bn-1-54321@invalid.local')
  })

  it('should not set envelope address when bounce is disabled', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    const realGet = app.models.Notification.app.get
    spyOn(app.models.Notification.app, 'get').and.callFake(function (param) {
      if (param === 'notification') {
        let val = Object.create(realGet.call(app, param))
        val.handleBounce = false
        return val
      } else {
        return realGet.call(app, param)
      }
    })

    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        channel: 'email',
        message: {
          from: 'no_reply@local.invalid',
          subject: 'test',
          textBody: 'test',
        },
        isBroadcast: true,
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].envelope
    ).toBeUndefined()
  })

  it('should not set envelope address when inboundSmtpServer.domain is undefined', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    const realGet = app.models.Notification.app.get
    spyOn(app.models.Notification.app, 'get').and.callFake(function (param) {
      if (param === 'inboundSmtpServer') {
        let val = Object.create(realGet.call(app, param))
        val.domain = undefined
        return val
      } else {
        return realGet.call(app, param)
      }
    })

    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        channel: 'email',
        message: {
          from: 'no_reply@local.invalid',
          subject: 'test',
          textBody: 'test',
        },
        isBroadcast: true,
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(
      app.models.Notification.sendEmail.calls.argsFor(0)[0].envelope
    ).toBeUndefined()
  })

  it('should handle batch broadcast request error', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    const realGet = app.models.Notification.app.get
    spyOn(app.models.Notification.app, 'get').and.callFake(function (param) {
      if (param === 'notification') {
        let val = Object.create(realGet.call(app, param))
        val.broadcastSubscriberChunkSize = 1
        val.broadcastSubRequestBatchSize = 2
        return val
      } else {
        return realGet.call(app, param)
      }
    })

    spyOn(app.models.Notification.request, 'get').and.callFake(
      async function () {
        throw 'error'
      }
    )

    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myChunkedBroadcastService',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody: 'test',
        },
        channel: 'email',
        isBroadcast: true,
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(
      res.body.failedDispatches.indexOf('bar1@foo.com')
    ).toBeGreaterThanOrEqual(0)
    expect(
      res.body.failedDispatches.indexOf('bar2@invalid')
    ).toBeGreaterThanOrEqual(0)
  })

  it('should handle async broadcastCustomFilterFunctions', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    await app.models.Subscription.create({
      serviceName: 'broadcastCustomFilterFunctionsTest',
      channel: 'email',
      userChannelId: 'bar2@invalid',
      state: 'confirmed',
      broadcastPushNotificationFilter: "contains_ci(name,'FOO')",
    })

    let res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'broadcastCustomFilterFunctionsTest',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody: 'test',
        },
        data: {
          name: 'foo',
        },
        channel: 'email',
        isBroadcast: true,
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Notification.sendEmail).toHaveBeenCalledTimes(1)
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'broadcastCustomFilterFunctionsTest',
      },
    })
    expect(data[0].state).toBe('sent')
  })
})
describe('PATCH /notifications/{id}', function () {
  beforeEach(async function () {
    await app.models.Notification.create({
      channel: 'inApp',
      isBroadcast: true,
      message: {
        title: 'test',
        body: 'this is a test',
      },
      serviceName: 'myService',
      state: 'new',
    })
  })
  it('should set readBy field of broadcast inApp notifications for sm users', async function () {
    let res = await request(app)
      .patch('/api/notifications/1')
      .send({
        serviceName: 'myService',
        state: 'read',
      })
      .set('Accept', 'application/json')
      .set('SM_USER', 'bar')
    expect(res.statusCode).toBe(200)
    let data = await app.models.Notification.findById(1)
    expect(data.readBy).toContain('bar')
    expect(data.state).toBe('new')
  })
  it('should set state field of broadcast inApp notifications for admin users', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .patch('/api/notifications/1')
      .send({
        state: 'deleted',
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    let data = await app.models.Notification.findById(1)
    expect(data.state).toBe('deleted')
  })
  it('should deny anonymous user', async function () {
    let res = await request(app)
      .patch('/api/notifications/1')
      .send({
        serviceName: 'myService',
        state: 'read',
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(403)
  })
})
describe('DELETE /notifications/{id}', function () {
  beforeEach(async function () {
    await app.models.Notification.create({
      channel: 'inApp',
      isBroadcast: true,
      message: {
        title: 'test',
        body: 'this is a test',
      },
      serviceName: 'myService',
      state: 'new',
    })
  })
  it('should set deletedBy field of broadcast inApp notifications for sm users', async function () {
    let res = await request(app)
      .delete('/api/notifications/1')
      .set('Accept', 'application/json')
      .set('SM_USER', 'bar')
    expect(res.statusCode).toBe(200)
    let data = await app.models.Notification.findById(1)
    expect(data.deletedBy).toContain('bar')
    expect(data.state).toBe('new')
  })
  it('should set state field of broadcast inApp notifications for admin users', async function () {
    spyOn(app.models.Notification, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .delete('/api/notifications/1')
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    let data = await app.models.Notification.findById(1)
    expect(data.state).toBe('deleted')
  })
  it('should deny anonymous user', async function () {
    let res = await request(app)
      .delete('/api/notifications/1')
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(403)
  })
})
