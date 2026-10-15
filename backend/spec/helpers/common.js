let app
beforeAll(done => {
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000
  require('../../server/server.js')(function(err, data) {
    app = data
    app.set('adminIps', [])
    done()
  })
})

beforeEach(function(done) {
  function fakeSendEmail() {
    let cb = arguments[arguments.length - 1]
    console.log('faking sendEmail')
    return cb(null, null)
  }

  function fakeSendSMS() {
    let cb = arguments[arguments.length - 1]
    console.log('faking sendSMS')
    return cb(null, null)
  }

  spyOn(app.models.Subscription, 'sendEmail').and.callFake(fakeSendEmail)
  spyOn(app.models.Subscription, 'sendSMS').and.callFake(fakeSendSMS)
  spyOn(app.models.Notification, 'sendEmail').and.callFake(fakeSendEmail)
  spyOn(app.models.Notification, 'sendSMS').and.callFake(fakeSendSMS)
  app.dataSources.db.automigrate(function(err) {
    expect(err).toBeUndefined()
    done()
  })
})
