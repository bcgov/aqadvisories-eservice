let app
var cronTasks = require('../../server/cron-tasks')
var parallel = require('async/parallel')
var path = require('path')
var fs = require('fs')
beforeAll((done) => {
  require('../../server/server.js')(function (err, data) {
    app = data
    done()
  })
})

describe('CRON purgeData', function () {
  it('should deleted old non-inApp notifications', async function () {
    await app.models.Notification.create({
      channel: 'email',
      isBroadcast: true,
      message: {
        title: 'test',
        body: 'this is a test',
      },
      serviceName: 'pastService',
      created: '2010-01-01',
      state: 'sent',
    })
    await app.models.Notification.create({
      channel: 'email',
      isBroadcast: true,
      message: {
        title: 'test',
        body: 'this is a test',
      },
      serviceName: 'futureService',
      created: '3020-01-01',
      state: 'sent',
    })
    try {
      await cronTasks.purgeData(app)
    } catch (err) {
      fail(err)
    }
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'futureService',
        channel: 'email',
      },
    })
    expect(data.length).toBe(1)
    data = await app.models.Notification.find({
      where: {
        serviceName: 'pastService',
        channel: 'email',
      },
    })
    expect(data.length).toBe(0)
  })

  it('should delete all expired inApp notifications', async function () {
    await app.models.Notification.create({
      channel: 'inApp',
      isBroadcast: true,
      message: {
        title: 'test',
        body: 'this is a test',
      },
      serviceName: 'expiredService',
      validTill: '2010-01-01',
      state: 'new',
    })
    await app.models.Notification.create({
      channel: 'inApp',
      isBroadcast: true,
      message: {
        title: 'test',
        body: 'this is a test',
      },
      serviceName: 'nonexpiredService',
      validTill: '3010-01-01',
      state: 'new',
    })
    try {
      await cronTasks.purgeData(app)
    } catch (err) {
      fail(err)
    }
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'nonexpiredService',
        channel: 'inApp',
      },
    })
    expect(data.length).toBe(1)
    data = await app.models.Notification.find({
      where: {
        serviceName: 'expiredService',
        channel: 'inApp',
      },
    })
    expect(data.length).toBe(0)
  })

  it('should delete all deleted inApp notifications', async function () {
    await app.models.Notification.create({
      channel: 'inApp',
      userId: 'foo',
      message: {
        title: 'test',
        body: 'this is a test',
      },
      serviceName: 'deletedService',
      state: 'deleted',
    })
    try {
      await cronTasks.purgeData(app)
    } catch (err) {
      fail(err)
    }
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'deletedService',
        channel: 'inApp',
      },
    })
    expect(data.length).toBe(0)
  })

  it('should delete all old non-confirmed subscriptions', async function () {
    spyOn(app.models.Subscription, 'updateTimestamp').and.callFake(function (
      ctx,
      next
    ) {
      return next()
    })
    await app.models.Subscription.create({
      serviceName: 'unconfirmedService',
      channel: 'email',
      userChannelId: 'bar@foo.com',
      state: 'unconfirmed',
      confirmationRequest: {
        confirmationCodeRegex: '\\d{5}',
        sendRequest: true,
        from: 'no_reply@invlid.local',
        subject: 'Subscription confirmation',
        textBody: 'enter {confirmation_code} in email!',
        confirmationCode: '53007',
      },
      updated: '2010-01-01',
    })
    try {
      await cronTasks.purgeData(app)
    } catch (err) {
      fail(err)
    }
    let data = await app.models.Subscription.find({
      where: {
        serviceName: 'unconfirmedService',
        channel: 'email',
      },
    })
    expect(data.length).toBe(0)
  })

  it('should delete all old deleted bounces', async function () {
    spyOn(app.models.Bounce, 'updateTimestamp').and.callFake(function (
      ctx,
      next
    ) {
      return next()
    })
    let data = await app.models.Bounce.create({
      channel: 'email',
      userChannelId: 'foo@invalid.local',
      state: 'deleted',
      updated: '2010-01-01',
    })
    try {
      let results = await cronTasks.purgeData(app)
      expect(results[4].count).toBe(1)
    } catch (err) {
      fail(err)
    }
    data = await app.models.Bounce.findById(1)
    expect(data).toBe(null)
  })

  it('should not delete any newly deleted bounces', async function () {
    spyOn(app.models.Bounce, 'updateTimestamp').and.callFake(function (
      ctx,
      next
    ) {
      return next()
    })
    let data = await app.models.Bounce.create({
      channel: 'email',
      userChannelId: 'foo@invalid.local',
      state: 'deleted',
      // updated: default to now
    })
    try {
      let results = await cronTasks.purgeData(app)
      expect(results[4].count).toBe(0)
    } catch (err) {
      fail(err)
    }
    data = await app.models.Bounce.findById(1)
    expect(data).not.toBe(null)
  })
})

describe('CRON dispatchLiveNotifications', function () {
  beforeEach(function (done) {
    parallel(
      [
        function (cb) {
          app.models.Notification.create(
            {
              channel: 'email',
              message: {
                from: 'admin@foo.com',
                subject: 'test',
                textBody: 'this is a test {http_host}',
              },
              isBroadcast: true,
              serviceName: 'myService',
              httpHost: 'http://foo.com',
              asyncBroadcastPushNotification: false,
              invalidBefore: '2010-01-01',
              state: 'new',
            },
            function (err, res) {
              cb(err, res)
            }
          )
        },
        function (cb) {
          app.models.Notification.create(
            {
              channel: 'email',
              message: {
                from: 'admin@foo.com',
                subject: 'test',
                textBody: 'this is another test {http_host}',
              },
              serviceName: 'myService',
              httpHost: 'http://foo.com',
              userChannelId: 'bar@foo.com',
              invalidBefore: '3010-01-01',
              state: 'new',
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
              unsubscriptionCode: '12345',
            },
            function (err, res) {
              cb(err, res)
            }
          )
        },
      ],
      function (err, results) {
        expect(err).toBeNull()
        done()
      }
    )
  })

  it('should send all live push notifications', async function () {
    try {
      let results = await cronTasks.dispatchLiveNotifications(app)
      expect(results.length).toBe(1)
    } catch (err) {
      fail(err)
    }
    expect(app.models.Notification.sendEmail).toHaveBeenCalledWith(
      jasmine.objectContaining({
        from: 'admin@foo.com',
        to: 'bar@foo.com',
        subject: 'test',
        text: 'this is a test http://foo.com',
        html: undefined,
        list: {
          id: 'http://foo.com/myService',
          unsubscribe: [
            [
              'un-1-12345@invalid.local',
              'http://foo.com/api/subscriptions/1/unsubscribe?unsubscriptionCode=12345',
            ],
          ],
        },
      }),
      jasmine.any(Function)
    )
    expect(app.models.Notification.sendEmail).toHaveBeenCalledTimes(1)
    let data = await app.models.Notification.find({
      where: {
        serviceName: 'myService',
        channel: 'email',
        state: 'sent',
      },
    })
    expect(data.length).toBe(1)
  })
})

describe('CRON checkRssConfigUpdates', function () {
  beforeEach(function (done) {
    spyOn(cronTasks, 'request').and.callFake(async function () {
      var output = fs.createReadStream(__dirname + path.sep + 'rss.xml')
      return {
        status: 200,
        data: output,
      }
    })
    spyOn(cronTasks.request, 'post')
    parallel(
      [
        function (cb) {
          app.models.Configuration.create(
            {
              name: 'notification',
              serviceName: 'myService',
              value: {
                rss: {
                  url: 'http://myService/rss',
                  timeSpec: '0 0 1 0 0',
                  outdatedItemRetentionGenerations: 1,
                  includeUpdatedItems: false,
                  fieldsToCheckForUpdate: ['title'],
                },
                messageTemplates: {
                  email: {
                    from: 'no_reply@invlid.local',
                    subject: '{title}',
                    textBody: '{description}',
                    htmlBody: '{description}',
                  },
                },
                httpHost: 'http://foo',
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
              unsubscriptionCode: '12345',
            },
            function (err, res) {
              cb(err, res)
            }
          )
        },
      ],
      function (err, results) {
        expect(err).toBeNull()
        done()
      }
    )
  })

  it('should create rss task and post notifications at initial run', async function () {
    try {
      let rssTasks = await cronTasks.checkRssConfigUpdates(app, true)
      expect(rssTasks['1']).not.toBeNull()
    } catch (err) {
      fail(err)
    }
    expect(cronTasks.request.post).toHaveBeenCalledTimes(1)
    let joc = jasmine.objectContaining
    expect(cronTasks.request.post).toHaveBeenCalledWith(
      'http://foo/api/notifications',
      joc({
        httpHost: 'http://foo',
      }),
      jasmine.any(Object)
    )
    let results = await app.models.Rss.find()
    expect(results[0].items[0].author).toBe('foo')
  })

  it('should avoid sending notification for unchanged items', async function () {
    await app.models.Rss.create({
      serviceName: 'myService',
      items: [
        {
          title: 'Item 2',
          description: 'lorem ipsum',
          summary: 'lorem ipsum',
          pubDate: '1970-01-01T00:00:00.000Z',
          link: 'http://myservice/2',
          guid: '2',
          author: 'foo',
          _notifyBCLastPoll: '1970-01-01T00:00:00.000Z',
        },
        {
          title: 'Item 1',
          description: 'lorem ipsum',
          summary: 'lorem ipsum',
          pubDate: '1970-01-01T00:00:00.000Z',
          link: 'http://myservice/1',
          guid: '1',
          author: 'foo',
          _notifyBCLastPoll: '1970-01-01T00:00:00.000Z',
        },
      ],
      lastPoll: '1970-01-01T00:00:00.000Z',
    })
    await cronTasks.checkRssConfigUpdates(app, true)
    expect(cronTasks.request.post).not.toHaveBeenCalled()
    let results = await app.models.Rss.find()
    expect(results[0].items[0].author).toBe('foo')
  })

  it('should send notification for updated item', async function () {
    let res = await app.models.Configuration.findById(1)
    let newVal = res.value
    newVal.rss.includeUpdatedItems = true
    newVal.rss.outdatedItemRetentionGenerations = 100
    await res.updateAttribute('value', newVal)

    await app.models.Rss.create({
      serviceName: 'myService',
      items: [
        {
          title: 'Item',
          description: 'lorem ipsum',
          pubDate: '1970-01-01T00:00:00.000Z',
          link: 'http://myservice/1',
          guid: '1',
          author: 'foo',
          _notifyBCLastPoll: '1970-01-01T00:00:00.000Z',
        },
      ],
      lastPoll: '1970-01-01T00:00:00.000Z',
    })
    let rssTasks = await cronTasks.checkRssConfigUpdates(app, true)
    expect(cronTasks.request.post).toHaveBeenCalledTimes(1)
  })

  it('should handle error', async function () {
    cronTasks.request = jasmine.createSpy().and.callFake(async function () {
      return {
        status: 300,
      }
    })
    try {
      let rssTasks = await cronTasks.checkRssConfigUpdates(app, true)
      expect(rssTasks['1']).not.toBeNull()
    } catch (err) {
      expect(err).not.toBeNull()
    }
  })
})

describe('CRON deleteBounces', function () {
  it('should delete bounce records in which no messages since latestNotificationStarted', async function () {
    await app.models.Bounce.create({
      channel: 'email',
      userChannelId: 'foo@invalid.local',
      hardBounceCount: 6,
      state: 'active',
      latestNotificationStarted: '2018-09-30T17:27:44.501Z',
      latestNotificationEnded: '2018-07-30T17:27:45.261Z',
      bounceMessages: [
        {
          date: '2018-08-30T17:27:45.784Z',
          message: 'blah',
        },
      ],
    })
    try {
      await cronTasks.deleteBounces(app)
    } catch (err) {
      fail(err)
    }
    let item = await app.models.Bounce.findById(1)
    expect(item.state).toBe('deleted')
  })
  it('should not delete bounce records in which there are messages since latestNotificationStarted', async function () {
    await app.models.Bounce.create({
      channel: 'email',
      userChannelId: 'foo@invalid.local',
      hardBounceCount: 6,
      state: 'active',
      latestNotificationStarted: '2018-07-30T17:27:44.501Z',
      latestNotificationEnded: '2018-07-30T17:27:45.261Z',
      bounceMessages: [
        {
          date: '2018-08-30T17:27:45.784Z',
          message: 'blah',
        },
      ],
    })
    try {
      await cronTasks.deleteBounces(app)
    } catch (err) {
      fail(err)
    }
    let item = await app.models.Bounce.findById(1)
    expect(item.state).toBe('active')
  })
})
