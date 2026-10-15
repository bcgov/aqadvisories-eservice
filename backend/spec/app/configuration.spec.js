let app
var request = require('supertest')
beforeAll(done => {
  require('../../server/server.js')(function(err, data) {
    app = data
    done()
  })
})

describe('GET /configuration', function() {
  beforeEach(async function() {
    await app.models.Configuration.create({
      name: 'subscription',
      serviceName: 'myService',
      value: {
        confirmationRequest: {
          sms: {
            textBody: 'enter {confirmation_code}!'
          },
          email: {
            textBody: 'enter {confirmation_code} in email!'
          }
        },
        anonymousUndoUnsubscription: {
          successMessage: 'You have been re-subscribed.',
          failureMessage: 'Error happened while re-subscribing.'
        }
      }
    })
  })
  it('should be forbidden by anonymous user', async function() {
    let res = await request(app).get('/api/configurations')
    expect(res.statusCode).toBe(403)
  })
  it('should be allowed by admin user', async function() {
    spyOn(app.models.Configuration, 'isAdminReq').and.callFake(function() {
      return true
    })
    let res = await request(app).get('/api/configurations')
    expect(res.statusCode).toBe(200)
  })
})
