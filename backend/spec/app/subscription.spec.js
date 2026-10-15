let app
var request = require('supertest')
var parallel = require('async/parallel')
beforeAll((done) => {
  require('../../server/server.js')(function (err, data) {
    app = data
    done()
  })
})

describe('GET /subscriptions', function () {
  var data
  beforeEach(async function () {
    data = await app.models.Subscription.create({
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
        confirmationCode: '37688',
      },
      unsubscriptionCode: '50032',
    })
  })

  it('should be forbidden by anonymous user', async function () {
    let res = await request(app).get('/api/subscriptions')
    expect(res.statusCode).toBe(403)
  })

  it("should return sm user's own subscription", async function () {
    let res = await request(app)
      .get('/api/subscriptions')
      .set('Accept', 'application/json')
      .set('SM_USER', 'baz')
    expect(res.statusCode).toBe(200)
    expect(res.body.length).toBe(0)
  })

  it('should have confirmationRequest field removed for sm user requests', async function () {
    let res = await request(app)
      .get('/api/subscriptions')
      .set('Accept', 'application/json')
      .set('SM_USER', 'bar')
    expect(res.statusCode).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0].confirmationRequest).toBeUndefined()
  })

  it('should be allowed by admin users', async function () {
    spyOn(app.models.Subscription, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app).get('/api/subscriptions')
    expect(res.statusCode).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0].confirmationRequest).not.toBeUndefined()
  })
})

describe('POST /subscriptions', function () {
  it('should allow admin users create subscriptions without sending confirmation request', async function () {
    spyOn(app.models.Subscription, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .post('/api/subscriptions')
      .send({
        serviceName: 'myService',
        channel: 'email',
        userChannelId: 'bar@foo.com',
        state: 'confirmed',
        confirmationRequest: {
          sendRequest: false,
        },
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Subscription.sendEmail).not.toHaveBeenCalled()
    let data = await app.models.Subscription.find({
      where: {
        serviceName: 'myService',
        userChannelId: 'bar@foo.com',
      },
    })
    expect(data[0].state).toBe('confirmed')
  })

  it('should allow admin users create subscriptions and send confirmation request with proper mail merge', async function () {
    spyOn(app.models.Subscription, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .post('/api/subscriptions')
      .send({
        serviceName: 'myService',
        channel: 'email',
        userChannelId: 'foo@bar.com',
        unsubscriptionCode: '54321',
        confirmationRequest: {
          from: 'a@b.com',
          subject: 'subject',
          sendRequest: true,
          textBody:
            '{subscription_confirmation_code} {service_name} {http_host} {rest_api_root} {subscription_id} {unsubscription_code} {unsubscription_url} {subscription_confirmation_url} {unsubscription_reversion_url}',
          confirmationCode: '12345',
        },
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Subscription.sendEmail).toHaveBeenCalled()
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).not.toContain('{subscription_confirmation_code}')
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).not.toContain('{service_name}')
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).not.toContain('{http_host}')
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).not.toContain('{rest_api_root}')
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).not.toContain('{subscription_id}')
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).not.toContain('{unsubscription_code}')
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).not.toContain('{unsubscription_url}')
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).not.toContain('{subscription_confirmation_url}')
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).not.toContain('{unsubscription_reversion_url}')
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).toContain('12345')
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).toContain('myService')
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).toContain('http://127.0.0.1')
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).toContain('/api')
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).toContain('1 ')
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).toContain('54321')
    //unsubscription_url
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).toContain('/api/subscriptions/1/unsubscribe?unsubscriptionCode=54321')
    //subscription_confirmation_url
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).toContain('/api/subscriptions/1/verify?confirmationCode=12345')
    //unsubscription_reversion_url
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).toContain(
      '/api/subscriptions/1/unsubscribe/undo?unsubscriptionCode=54321'
    )

    let data = await app.models.Subscription.find({
      where: {
        serviceName: 'myService',
        userChannelId: 'foo@bar.com',
      },
    })
    expect(data.length).toBe(1)
  })

  it('should generate unsubscription code for subscriptions created by admin user', async function () {
    spyOn(app.models.Subscription, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .post('/api/subscriptions')
      .send({
        serviceName: 'myService',
        channel: 'sms',
        userChannelId: '250-555-0100',
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Subscription.sendSMS).toHaveBeenCalledTimes(1)
    let data = await app.models.Subscription.find({
      where: {
        serviceName: 'myService',
        userChannelId: '250-555-0100',
      },
    })
    expect(data[0].unsubscriptionCode).toMatch(/\d{5}/)
  })

  it('should generate unsubscription code for subscriptions created by admin user with confirmationRequest field populated', async function () {
    spyOn(app.models.Subscription, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .post('/api/subscriptions')
      .send({
        serviceName: 'myService',
        channel: 'email',
        userChannelId: 'foo@bar.com',
        confirmationRequest: {
          from: 'foo@invalid.local',
          subject: 'subject',
          sendRequest: true,
          textBody:
            '{subscription_confirmation_code} {service_name} {http_host} {rest_api_root} {subscription_id} {unsubscription_code} {unsubscription_url} {subscription_confirmation_url} {unsubscription_reversion_url}',
          confirmationCodeRegex: '12345',
        },
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Subscription.sendEmail).toHaveBeenCalledTimes(1)
    let data = await app.models.Subscription.find({
      where: {
        serviceName: 'myService',
        userChannelId: 'foo@bar.com',
      },
    })
    expect(data[0].confirmationRequest.confirmationCode).toBe('12345')
  })

  it('should allow non-admin user create sms subscription using swift provider', async function () {
    app.models.Subscription.sendSMS.and.stub().and.callThrough()
    let common = require('../../common/mixins/common')
    spyOn(common.axios, 'post').and.callFake(async () => {
      return
    })

    let res = await request(app)
      .post('/api/subscriptions')
      .send({
        serviceName: 'myService',
        channel: 'sms',
        userChannelId: '250-555-0100',
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Subscription.sendSMS).toHaveBeenCalledTimes(1)
    expect(common.axios.post.calls.argsFor(0)[0]).toBe(
      'https://secure.smsgateway.ca/services/message.svc/123/250-555-0100'
    )
    expect(common.axios.post.calls.argsFor(0)[1]['MessageBody']).toMatch(
      /Enter \d{5} on screen/
    )
    let data = await app.models.Subscription.find({
      where: {
        serviceName: 'myService',
        userChannelId: '250-555-0100',
      },
    })
    expect(data[0].unsubscriptionCode).toMatch(/\d{5}/)
  })

  it('should ignore message supplied by non-admin user when creating a subscription', async function () {
    let res = await request(app)
      .post('/api/subscriptions')
      .send({
        serviceName: 'myService',
        channel: 'email',
        userChannelId: 'nobody@local.invalid',
        confirmationRequest: {
          confirmationCodeRegex: '\\d{5}',
          sendRequest: true,
          from: 'nobody@local.invalid',
          subject: 'spoofed subject',
          textBody: 'spoofed body',
          confirmationCode: '41488',
        },
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Subscription.sendEmail).toHaveBeenCalledTimes(1)
    let data = await app.models.Subscription.find({
      where: {
        serviceName: 'myService',
        userChannelId: 'nobody@local.invalid',
      },
    })
    expect(data[0].confirmationRequest.textBody).not.toContain('spoofed')
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].subject
    ).not.toContain('spoofed')
  })

  it('should reject subscriptions with invalid string broadcastPushNotificationFilter', async function () {
    let res = await request(app)
      .post('/api/subscriptions')
      .send({
        serviceName: 'myService',
        channel: 'sms',
        userChannelId: '250-555-0100',
        broadcastPushNotificationFilter: "a === 'b'",
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(400)
    let data = await app.models.Subscription.find({
      where: {
        serviceName: 'myService',
        userChannelId: '250-555-0100',
      },
    })
    expect(data.length).toBe(0)
  })

  it('should accept subscriptions with valid broadcastPushNotificationFilter', async function () {
    let res = await request(app)
      .post('/api/subscriptions')
      .send({
        serviceName: 'myService',
        channel: 'sms',
        userChannelId: '250-555-0100',
        broadcastPushNotificationFilter: "a == 'b'",
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Subscription.sendSMS).toHaveBeenCalledTimes(1)
    let data = await app.models.Subscription.find({
      where: {
        serviceName: 'myService',
        userChannelId: '250-555-0100',
      },
    })
    expect(data[0].unsubscriptionCode).toMatch(/\d{5}/)
  })

  it('should detect duplicated subscription', async function () {
    spyOn(app.models.Subscription, 'getMergedConfig').and.callFake(
      async function () {
        const res = {
          detectDuplicatedSubscription: true,
          duplicatedSubscriptionNotification: {
            email: {
              from: 'no_reply@invalid.local',
              subject: 'Duplicated Subscription',
              textBody:
                'A duplicated subscription was submitted and rejected. you will continue receiving notifications. If the request was not created by you, please ignore this message.',
            },
          },
          confirmationRequest: {
            email: {
              confirmationCodeRegex: '\\d{5}',
              sendRequest: true,
              from: 'no_reply@invalid.local',
              subject: 'Subscription confirmation',
              textBody: 'Enter {subscription_confirmation_code} on screen',
            },
          },
          anonymousUnsubscription: {
            code: {
              required: true,
              regex: '\\d{5}',
            },
          },
        }
        let cb = arguments[arguments.length - 1]
        if (typeof cb === 'function') {
          return process.nextTick(cb, null, res)
        } else {
          return res
        }
      }
    )

    await app.models.Subscription.create({
      serviceName: 'myService',
      channel: 'email',
      userId: 'bar',
      userChannelId: 'bar@invalid.local',
      state: 'confirmed',
    })
    let res = await request(app)
      .post('/api/subscriptions')
      .send({
        serviceName: 'myService',
        channel: 'email',
        userChannelId: 'bar@invalid.local',
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(app.models.Subscription.sendEmail).toHaveBeenCalled()
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).toContain('A duplicated subscription')
    let data = await app.models.Subscription.find({
      where: {
        serviceName: 'myService',
        channel: 'email',
        state: 'unconfirmed',
        userChannelId: 'bar@invalid.local',
      },
    })
    expect(data.length).toBe(1)
  })

  const invalidNanpNumbers = {
    'fewer than 10 digits': '250-555-010',
    'more than 10 digits': '250-555-01000',
    'a non-numeric value': 'not-a-phone',
    'an area code starting with 0': '050-555-0100',
    'an area code starting with 1': '150-555-0100',
    'an exchange code starting with 0': '250-055-0100',
    'an exchange code starting with 1': '250-155-0100',
  }
  Object.keys(invalidNanpNumbers).forEach(function (description) {
    it('should reject an sms subscription with ' + description, async function () {
      let res = await request(app)
        .post('/api/subscriptions')
        .send({
          serviceName: 'myService',
          channel: 'sms',
          userChannelId: invalidNanpNumbers[description],
        })
        .set('Accept', 'application/json')
      expect(res.statusCode).toBe(422)
      expect(app.models.Subscription.sendSMS).not.toHaveBeenCalled()
      let data = await app.models.Subscription.find({
        where: { serviceName: 'myService', channel: 'sms' },
      })
      expect(data.length).toBe(0)
    })
  })

  const normalizableNanpNumbers = [
    '2505550100',
    '250 555 0100',
    '(250) 555-0100',
    '250.555.0100',
    '1-250-555-0100',
    '+1 250 555 0100',
  ]
  normalizableNanpNumbers.forEach(function (input) {
    it(
      'should accept and canonicalize the sms number ' + input,
      async function () {
        let res = await request(app)
          .post('/api/subscriptions')
          .send({
            serviceName: 'myService',
            channel: 'sms',
            userChannelId: input,
          })
          .set('Accept', 'application/json')
        expect(res.statusCode).toBe(200)
        let data = await app.models.Subscription.find({
          where: { serviceName: 'myService', channel: 'sms' },
        })
        expect(data.length).toBe(1)
        expect(data[0].userChannelId).toBe('250-555-0100')
      }
    )
  })

  it('should not apply the NANP rule to email subscriptions', async function () {
    let res = await request(app)
      .post('/api/subscriptions')
      .send({
        serviceName: 'myService',
        channel: 'email',
        userChannelId: 'foo@invalid.local',
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    let data = await app.models.Subscription.find({
      where: { serviceName: 'myService', channel: 'email' },
    })
    expect(data[0].userChannelId).toBe('foo@invalid.local')
  })
})

describe('PATCH /subscriptions/{id}', function () {
  beforeEach(async function () {
    await app.models.Subscription.create({
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
        confirmationCode: '37688',
      },
      unsubscriptionCode: '50032',
    })
  })
  it('should allow sm users change their user channel id', async function () {
    let res = await request(app)
      .patch('/api/subscriptions/1')
      .send({
        userChannelId: 'baz@foo.com',
      })
      .set('Accept', 'application/json')
      .set('SM_USER', 'bar')
    expect(res.body.state).toBe('unconfirmed')
    expect(res.body.userChannelId).toBe('baz@foo.com')
  })
  it("should deny sm user from changing other user's subscription", async function () {
    let res = await request(app)
      .patch('/api/subscriptions/1')
      .send({
        userChannelId: 'baz@foo.com',
      })
      .set('Accept', 'application/json')
      .set('SM_USER', 'baz')
    expect(res.statusCode).toBe(404)
  })
  it("should deny anonymous user's access", async function () {
    let res = await request(app)
      .patch('/api/subscriptions/1')
      .send({
        userChannelId: 'baz@foo.com',
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(403)
  })
})

describe('GET /subscriptions/{id}/verify', function () {
  let data
  beforeEach(async function () {
    data = await parallel([
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myService',
            channel: 'email',
            userId: 'bar',
            userChannelId: 'bar@foo.com',
            state: 'unconfirmed',
            confirmationRequest: {
              confirmationCode: '37688',
            },
          },
          function (err, res) {
            cb(err, res)
          }
        )
      },
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myService',
            channel: 'email',
            userChannelId: 'bar@foo.com',
            state: 'unconfirmed',
            confirmationRequest: {
              confirmationCode: '37689',
            },
          },
          function (err, res) {
            cb(err, res)
          }
        )
      },
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myService',
            channel: 'email',
            userChannelId: 'bar@foo.com',
            state: 'confirmed',
          },
          function (err, res) {
            cb(err, res)
          }
        )
      },
    ])
  })

  it('should verify confirmation code sent by sm user', async function () {
    let res = await request(app)
      .get(
        '/api/subscriptions/' + data[0].id + '/verify?confirmationCode=37688'
      )
      .set('Accept', 'application/json')
      .set('SM_USER', 'bar')
    expect(res.statusCode).toBe(200)
    res = await app.models.Subscription.findById(data[0].id)
    expect(res.state).toBe('confirmed')
  })

  it('should verify confirmation code sent by anonymous user', async function () {
    let res = await request(app).get(
      '/api/subscriptions/' + data[1].id + '/verify?confirmationCode=37689'
    )
    expect(res.statusCode).toBe(200)
    res = await app.models.Subscription.findById(data[1].id)
    expect(res.state).toBe('confirmed')
  })

  it('should deny incorrect confirmation code', async function () {
    let res = await request(app).get(
      '/api/subscriptions/' + data[1].id + '/verify?confirmationCode=0000'
    )
    expect(res.statusCode).toBe(403)
    res = await app.models.Subscription.findById(data[1].id)
    expect(res.state).toBe('unconfirmed')
  })

  it('should unsubscribe existing subscriptions when replace paramter is supplied', async function () {
    let res = await request(app).get(
      '/api/subscriptions/' +
        data[1].id +
        '/verify?confirmationCode=37689&replace=true'
    )
    expect(res.statusCode).toBe(200)
    res = await app.models.Subscription.findById(data[2].id)
    expect(res.state).toBe('deleted')
  })
})

describe('DELETE /subscriptions/{id}', function () {
  let data
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
              confirmationCode: '37688',
            },
          },
          function (err, res) {
            cb(err, res)
          }
        )
      },
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myService',
            channel: 'email',
            userChannelId: 'bar@foo.com',
            state: 'confirmed',
            confirmationRequest: {
              confirmationCodeRegex: '\\d{5}',
              sendRequest: true,
              from: 'no_reply@invlid.local',
              subject: 'Subscription confirmation',
              textBody: 'enter {confirmation_code} in this email',
              confirmationCode: '37689',
            },
            unsubscriptionCode: '50032',
          },
          function (err, res) {
            cb(err, res)
          }
        )
      },
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myService',
            channel: 'email',
            userChannelId: 'bar@foo.com',
            state: 'unconfirmed',
            confirmationRequest: {
              confirmationCodeRegex: '\\d{5}',
              sendRequest: true,
              from: 'no_reply@invlid.local',
              subject: 'Subscription confirmation',
              textBody: 'enter {confirmation_code} in this email',
              confirmationCode: '37689',
            },
          },
          function (err, res) {
            cb(err, res)
          }
        )
      },
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'redirectAck',
            channel: 'email',
            userChannelId: 'bar@foo.com',
            state: 'confirmed',
            unsubscriptionCode: '12345',
          },
          cb
        )
      },
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'redirectAck',
            channel: 'email',
            userChannelId: 'bar@foo.com',
            state: 'deleted',
            unsubscriptionCode: '12345',
          },
          cb
        )
      },
      function (cb) {
        app.models.Configuration.create(
          {
            name: 'subscription',
            serviceName: 'redirectAck',
            value: {
              anonymousUnsubscription: {
                acknowledgements: {
                  onScreen: {
                    redirectUrl: 'http://nowhere',
                  },
                },
              },
            },
          },
          cb
        )
      },
    ])
  })

  it('should allow unsubscription by sm user', async function () {
    let res = await request(app)
      .delete('/api/subscriptions/' + data[0].id)
      .set('Accept', 'application/json')
      .set('SM_USER', 'bar')
    expect(res.statusCode).toBe(200)
    res = await app.models.Subscription.findById(data[0].id)
    expect(res.state).toBe('deleted')
  })

  it('should allow unsubscription by anonymous user', async function () {
    let res = await request(app)
      .get(
        '/api/subscriptions/' +
          data[1].id +
          '/unsubscribe?unsubscriptionCode=50032'
      )
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    res = await app.models.Subscription.findById(data[1].id)
    expect(res.state).toBe('deleted')
  })

  it('should deny unsubscription by anonymous user with incorrect unsubscriptionCode', async function () {
    let res = await request(app)
      .get(
        '/api/subscriptions/' +
          data[1].id +
          '/unsubscribe?unsubscriptionCode=50033'
      )
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(403)
    res = await app.models.Subscription.findById(data[1].id)
    expect(res.state).toBe('confirmed')
  })

  it('should deny unsubscription if state is not confirmed', async function () {
    let res = await request(app)
      .get(
        '/api/subscriptions/' +
          data[2].id +
          '/unsubscribe?unsubscriptionCode=50033'
      )
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(403)
    res = await app.models.Subscription.findById(data[2].id)
    expect(res.state).toBe('unconfirmed')
  })

  it('should deny unsubscription by another sm user', async function () {
    let res = await request(app)
      .delete('/api/subscriptions/' + data[0].id)
      .set('Accept', 'application/json')
      .set('SM_USER', 'baz')
    expect(res.statusCode).toBe(404)
    res = await app.models.Subscription.findById(data[0].id)
    expect(res.state).toBe('confirmed')
  })

  it('should redirect onscreen acknowledgements', async function () {
    let res = await request(app)
      .get(
        '/api/subscriptions/' +
          data[3].id +
          '/unsubscribe?unsubscriptionCode=12345'
      )
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(302)
    expect(res.header.location).toBe('http://nowhere?channel=email')
    res = await app.models.Subscription.findById(data[3].id)
    expect(res.state).toBe('deleted')
  })

  it('should redirect onscreen acknowledgements with error', async function () {
    spyOn(app.models.Subscription, 'getMergedConfig').and.callFake(
      async function () {
        return {
          anonymousUnsubscription: {
            acknowledgements: {
              onScreen: {
                redirectUrl: 'http://nowhere',
              },
            },
          },
        }
      }
    )

    let res = await request(app)
      .get(
        '/api/subscriptions/' +
          data[4].id +
          '/unsubscribe?unsubscriptionCode=12345'
      )
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(302)
    expect(res.header.location).toBe(
      'http://nowhere?channel=email&err=Error%3A%20Forbidden'
    )
  })

  it('should display onScreen acknowledgements failureMessage', async function () {
    spyOn(app.models.Subscription, 'getMergedConfig').and.callFake(
      async function () {
        return {
          anonymousUnsubscription: {
            acknowledgements: {
              onScreen: {
                failureMessage: 'fail',
              },
            },
          },
        }
      }
    )

    let res = await request(app)
      .get(
        '/api/subscriptions/' +
          data[4].id +
          '/unsubscribe?unsubscriptionCode=12345'
      )
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(403)
    expect(res.text).toBe('fail')
    expect(res.type).toBe('text/plain')
  })
})

describe('GET /subscriptions/{id}/unsubscribe', function () {
  let data
  beforeEach(async function () {
    data = await parallel([
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myService1',
            channel: 'email',
            userChannelId: 'bar@foo.com',
            state: 'confirmed',
            unsubscriptionCode: '12345',
          },
          cb
        )
      },
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myService2',
            channel: 'email',
            userChannelId: 'bar@foo.com',
            state: 'confirmed',
            unsubscriptionCode: '54321',
          },
          cb
        )
      },
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myService3',
            channel: 'email',
            userChannelId: 'bar@foo.com',
            state: 'confirmed',
            unsubscriptionCode: '11111',
          },
          cb
        )
      },
    ])
  })

  it('should allow bulk unsubscribing all services', async function () {
    spyOn(app.models.Subscription, 'getMergedConfig').and.callFake(
      async function () {
        return {
          anonymousUnsubscription: {
            acknowledgements: {
              onScreen: { successMessage: '' },
              notification: {
                email: {
                  from: 'no_reply@invalid.local',
                  subject: '',
                  textBody: '{unsubscription_service_names}',
                  htmlBody: '{unsubscription_service_names}',
                },
              },
            },
          },
        }
      }
    )

    let res = await request(app).get(
      '/api/subscriptions/' +
        data[0].id +
        '/unsubscribe?unsubscriptionCode=12345&additionalServices=_all'
    )
    expect(res.statusCode).toBe(200)
    res = await app.models.Subscription.find({
      where: {
        state: 'deleted',
      },
    })
    expect(res.length).toBe(3)
    expect(
      app.models.Subscription.sendEmail.calls.argsFor(0)[0].text
    ).toContain('services myService1, myService2 and myService3')
  })

  it('should allow bulk unsubscribing selcted additional service', async function () {
    let res = await request(app).get(
      '/api/subscriptions/' +
        data[0].id +
        '/unsubscribe?unsubscriptionCode=12345&additionalServices=myService3'
    )
    expect(res.statusCode).toBe(200)
    res = await app.models.Subscription.find({
      where: {
        state: 'deleted',
      },
    })
    expect(res.length).toBe(2)
  })

  it('should allow bulk unsubscribing selcted additional service as an array', async function () {
    let res = await request(app).get(
      '/api/subscriptions/' +
        data[0].id +
        '/unsubscribe?unsubscriptionCode=12345&additionalServices=["myService3"]'
    )
    expect(res.statusCode).toBe(200)
    res = await app.models.Subscription.find({
      where: {
        state: 'deleted',
      },
    })
    expect(res.length).toBe(2)
  })
})

describe('GET /subscriptions/{id}/unsubscribe/undo', function () {
  let data
  beforeEach(async function () {
    data = await parallel([
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myService',
            channel: 'email',
            userChannelId: 'bar@foo.com',
            state: 'deleted',
            unsubscriptionCode: '50032',
          },
          cb
        )
      },
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myService',
            channel: 'email',
            userChannelId: 'bar@foo.com',
            state: 'unconfirmed',
            confirmationRequest: {
              confirmationCodeRegex: '\\d{5}',
              sendRequest: true,
              from: 'no_reply@invlid.local',
              subject: 'Subscription confirmation',
              textBody: 'enter {confirmation_code} in this email',
              confirmationCode: '37689',
            },
            unsubscriptionCode: '50032',
          },
          function (err, res) {
            cb(err, res)
          }
        )
      },
      function (cb) {
        app.models.Subscription.create(
          {
            serviceName: 'myService2',
            channel: 'email',
            userChannelId: 'bar@foo.com',
            state: 'deleted',
            unsubscriptionCode: '12345',
            unsubscribedAdditionalServices: {
              names: ['myService'],
              ids: [1],
            },
          },
          cb
        )
      },
    ])
  })

  it('should allow undelete subscription by anonymous user', async function () {
    let res = await request(app)
      .get(
        '/api/subscriptions/' +
          data[0].id +
          '/unsubscribe/undo?unsubscriptionCode=50032'
      )
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    res = await app.models.Subscription.findById(data[0].id)
    expect(res.state).toBe('confirmed')
  })

  it('should forbid undelete subscription by anonymous user with incorrect unsubscriptionCode', async function () {
    let res = await request(app)
      .get(
        '/api/subscriptions/' +
          data[0].id +
          '/unsubscribe/undo?unsubscriptionCode=50033'
      )
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(403)
    res = await app.models.Subscription.findById(data[0].id)
    expect(res.state).toBe('deleted')
  })

  it('should forbid undelete subscription where state is not deleted', async function () {
    let res = await request(app)
      .get(
        '/api/subscriptions/' +
          data[1].id +
          '/unsubscribe/undo?unsubscriptionCode=50032'
      )
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(403)
    res = await app.models.Subscription.findById(data[1].id)
    expect(res.state).toBe('unconfirmed')
  })

  it('should redirect response if set so', async function () {
    await app.models.Configuration.create({
      name: 'subscription',
      serviceName: 'myService',
      value: {
        anonymousUndoUnsubscription: {
          redirectUrl: 'http://nowhere',
        },
      },
    })
    let res = await request(app).get(
      '/api/subscriptions/' +
        data[0].id +
        '/unsubscribe/undo?unsubscriptionCode=50032'
    )
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('http://nowhere?channel=email')
    res = await app.models.Subscription.findById(data[0].id)
    expect(res.state).toBe('confirmed')
  })

  it('should allow bulk undo unsubscriptions by anonymous user', async function () {
    let res = await request(app).get(
      '/api/subscriptions/' +
        data[2].id +
        '/unsubscribe/undo?unsubscriptionCode=12345'
    )
    expect(res.statusCode).toBe(200)
    res = await app.models.Subscription.findById(data[0].id)
    expect(res.state).toBe('confirmed')
    res = await app.models.Subscription.findById(data[2].id)
    expect(res.unsubscribedAdditionalServices).toBeUndefined()
  })
})

describe('PUT /subscriptions/{id}', function () {
  beforeEach(async function () {
    await app.models.Subscription.create({
      serviceName: 'myService',
      channel: 'email',
      userId: 'bar',
      userChannelId: 'bar@invalid.local',
      state: 'confirmed',
      confirmationRequest: {
        confirmationCodeRegex: '\\d{5}',
        sendRequest: true,
        from: 'no_reply@invlid.local',
        subject: 'Subscription confirmation',
        textBody: 'enter {confirmation_code} in this email',
        confirmationCode: '37688',
      },
      unsubscriptionCode: '50032',
    })
  })
  it('should allow admin user replace subscription', async function () {
    spyOn(app.models.Subscription, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .put('/api/subscriptions/1')
      .send({
        serviceName: 'myService',
        channel: 'email',
        userId: 'bar',
        userChannelId: 'bar@invalid.local',
        state: 'deleted',
        unsubscriptionCode: '50033',
      })
      .set('Accept', 'application/json')
    expect(res.body.state).toBe('deleted')
    expect(res.body.confirmationRequest).toBeUndefined()
  })
  it('should deny anonymous user replace subscription', async function () {
    let res = await request(app)
      .put('/api/subscriptions/1')
      .send({
        serviceName: 'myService',
        channel: 'email',
        userId: 'bar',
        userChannelId: 'bar@invalid.local',
        state: 'deleted',
        unsubscriptionCode: '50032',
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(403)
  })
})

describe('GET /subscriptions/services', function () {
  beforeEach(async function () {
    await app.models.Subscription.create({
      serviceName: 'myService',
      channel: 'email',
      userId: 'bar',
      userChannelId: 'bar@invalid.local',
      state: 'confirmed',
      confirmationRequest: {
        confirmationCodeRegex: '\\d{5}',
        sendRequest: true,
        from: 'no_reply@invlid.local',
        subject: 'Subscription confirmation',
        textBody: 'enter {confirmation_code} in this email',
        confirmationCode: '37688',
      },
      unsubscriptionCode: '50032',
    })
  })
  it(`should allow admin user's access`, async function () {
    spyOn(app.models.Subscription, 'isAdminReq').and.callFake(function () {
      return true
    })
    let res = await request(app)
      .get('/api/subscriptions/services')
      .set('Accept', 'application/json')
    expect(res.body instanceof Array).toBe(true)
    expect(res.body.length).toBe(1)
  })
  it("should deny anonymous user's access", async function () {
    let res = await request(app)
      .get('/api/subscriptions/services')
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(403)
  })
})

describe('POST /subscriptions/swift', function () {
  beforeEach(async function () {
    await app.models.Subscription.create({
      serviceName: 'myService',
      channel: 'sms',
      userChannelId: '250-000-0000',
      state: 'confirmed',
      unsubscriptionCode: '12345',
    })
  })
  it(`should unsubscribe with valid id reference`, async function () {
    let realGet = app.models.Subscription.app.get
    spyOn(app.models.Subscription.app, 'get').and.callFake(function (param) {
      if (param === 'sms') {
        return {
          swift: { notifyBCSwiftKey: '12345' },
        }
      } else {
        return realGet.call(app, param)
      }
    })
    let res = await request(app).post('/api/subscriptions/swift').send({
      Reference: 1,
      PhoneNumber: '12500000000',
      notifyBCSwiftKey: '12345',
    })
    expect(res.statusCode).toBe(200)
    expect(res.text).toBe('You have been un-subscribed.')
    res = await app.models.Subscription.findById(1)
    expect(res.state).toBe('deleted')
  })
  it(`should unsubscribe with valid phone number`, async function () {
    let realGet = app.models.Subscription.app.get
    spyOn(app.models.Subscription.app, 'get').and.callFake(function (param) {
      if (param === 'sms') {
        return {
          swift: { notifyBCSwiftKey: '12345' },
        }
      } else {
        return realGet.call(app, param)
      }
    })
    let res = await request(app).post('/api/subscriptions/swift').send({
      PhoneNumber: '12500000000',
      notifyBCSwiftKey: '12345',
    })
    expect(res.statusCode).toBe(200)
    expect(res.text).toBe('You have been un-subscribed.')
    res = await app.models.Subscription.findById(1)
    expect(res.state).toBe('deleted')
  })
  it(`should deny invalid Reference`, async function () {
    let realGet = app.models.Subscription.app.get
    spyOn(app.models.Subscription.app, 'get').and.callFake(function (param) {
      if (param === 'sms') {
        return {
          swift: { notifyBCSwiftKey: '12345' },
        }
      } else {
        return realGet.call(app, param)
      }
    })
    let res = await request(app).post('/api/subscriptions/swift').send({
      Reference: 1,
      PhoneNumber: '12500000000',
      notifyBCSwiftKey: 'invalid',
    })
    expect(res.statusCode).toBe(403)
    res = await app.models.Subscription.findById(1)
    expect(res.state).toBe('confirmed')
  })
})
