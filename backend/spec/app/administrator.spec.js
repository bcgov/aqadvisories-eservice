let app
var request = require('supertest')
beforeAll(done => {
  require('../../server/server.js')(function(err, data) {
    app = data
    done()
  })
})

describe('administrator', function() {
  it('should be allowed to create, login, get access token, and then use it to post notification', async function() {
    spyOn(app.models.Administrator, 'isAdminReq').and.callFake(function() {
      return true
    })
    let res = await request(app)
      .post('/api/administrators')
      .send({
        email: 'bar@foo.com',
        password: 'p'
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    res = await request(app)
      .post('/api/administrators/login')
      .send({
        email: 'bar@foo.com',
        password: 'p'
      })
      .set('Accept', 'application/json')
    expect(res.statusCode).toBe(200)
    expect(res.body.id).not.toBeNull()
    app.models.Administrator.isAdminReq = jasmine.createSpy().and.callThrough()
    res = await request(app)
      .post('/api/notifications')
      .send({
        serviceName: 'myService',
        message: {
          from: 'no_reply@bar.com',
          subject: 'test',
          textBody:
            'This is a broadcast test {confirmation_code} {service_name} {http_host} {rest_api_root} {subscription_id} {unsubscription_code}'
        },
        channel: 'email',
        isBroadcast: true
      })
      .set('Accept', 'application/json')
      .set('Authorization', res.body.id)
    expect(res.statusCode).toBe(200)
  }, 20000)
})
