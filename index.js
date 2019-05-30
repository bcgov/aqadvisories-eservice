const express = require('express')
const app = express()
const port = process.env.port || 8080
const role = process.env.notification_sender_role || 'realm:notificaton-sender'
const notifybcRootUrl =
  process.env.notify_bc_root_url || 'http://notify-bc:3000'
var session = require('express-session')
var Keycloak = require('keycloak-connect')
const axios = require('axios')
const bodyParser = require('body-parser')

var memoryStore = new session.MemoryStore()

let keycloak = new Keycloak({ store: memoryStore, idpHint: 'idir' })
if (process.env.trust_proxy) {
  app.set('trust proxy', process.env.trust_proxy)
}
app.use(
  session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    store: memoryStore
  })
)
app.use(keycloak.middleware())
app.get('/admin.html', keycloak.protect(role))

app.post('/api/subscriptions', bodyParser.urlencoded(), async (req, res) => {
  try {
    const response = await axios.post(
      notifybcRootUrl + '/api/subscriptions',
      req.body,
      {
        headers: {
          'X-Forwarded-For': req.ip
        }
      }
    )
    res.send(response.data)
  } catch (error) {
    res.status(error.response.status).end(error.response.statusText)
  }
})
app.post(
  '/api/notifications',
  keycloak.protect(role),
  bodyParser.urlencoded(),
  async (req, res) => {
    let data = req.body
    data.data = data.data || {}
    data.data.sender = {
      name: req.kauth.grant.access_token.content.name,
      email: req.kauth.grant.access_token.content.email
    }
    try {
      const response = await axios.post(
        notifybcRootUrl + '/api/notifications',
        data
      )
      res.send(response.data)
    } catch (error) {
      res.status(error.response.status).end(error.response.statusText)
    }
  }
)

app.use(express.static('static'))

app.listen(port, () => console.log(`app listening on port ${port}!`))
