const express = require('express')
const app = express()
const port = process.env.port || 8080
const role = process.env.notification_sender_role || 'realm:notificaton-sender'
const notifybcRootUrl =
  process.env.notify_bc_root_url || 'http://notify-bc:3000'
var session = require('express-session')
const FileStore = require('session-file-store')(session)
const Keycloak = require('keycloak-connect')
const axios = require('axios')
const bodyParser = require('body-parser')

app.get('/ping', (req, res) => res.send('ok'))

let storeOptions = { logFn: () => {} }
if (process.env.file_store_path) {
  storeOptions.path = process.env.file_store_path
}
var store = new FileStore(storeOptions)

let keycloak = new Keycloak({ store: store, idpHint: 'idir' })
if (process.env.trust_proxy) {
  app.set('trust proxy', process.env.trust_proxy)
}
app.use(
  session({
    name: 'aqaess',
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    store: store
  })
)
app.use(keycloak.middleware())
app.use(bodyParser.urlencoded({ extended: true }))
app.get('/admin.html', keycloak.protect(role))

app.post('/api/subscriptions', async (req, res) => {
  let data = {
    serviceName: 'envAirQuality',
    channel: 'email',
    city: req.body.city,
    userChannelId: req.body.userChannelId
  }
  if (data.city) {
    if (data.city instanceof Array) {
      data.broadcastPushNotificationFilter = data.city
        .map(e => {
          return "contains_ci(cities,'" + e + "')"
        })
        .join('||')
    } else if (typeof data.city == 'string') {
      data.broadcastPushNotificationFilter = `contains_ci(cities,'${
        data.city
      }')`
    }
    delete data.city
  }
  try {
    const response = await axios.post(
      notifybcRootUrl + '/api/subscriptions',
      data,
      {
        headers: {
          'X-Forwarded-For': req.ip
        }
      }
    )
    res.redirect('/subscription_sent.html')
  } catch (error) {
    res.status(error.response.status).end(error.response.statusText)
  }
})
app.post('/api/notifications', keycloak.protect(role), async (req, res) => {
  let data = {
    serviceName: 'envAirQuality',
    channel: 'email',
    isBroadcast: true,
    asyncBroadcastPushNotification: true,
    message: {
      from: 'donotreply@gov.bc.ca',
      subject: req.body.message.subject,
      htmlBody: req.body.message.htmlBody
    },
    city: req.body.city,
    data: {}
  }
  data.data.sender = {
    name: req.kauth.grant.access_token.content.name,
    email: req.kauth.grant.access_token.content.email
  }
  if (data.city) {
    if (data.city instanceof Array) {
      data.data.cities = data.city.join(', ')
    } else if (typeof data.city == 'string') {
      data.data.cities = data.city
    }
    delete data.city
  }
  data.message.htmlBody = `<pre>${
    data.message.htmlBody
  }</pre><br/><a href="{unsubscription_url}">Unsubscribe</a>`

  try {
    const response = await axios.post(
      notifybcRootUrl + '/api/notifications',
      data
    )
    res.redirect('/advisory_sent.html')
  } catch (error) {
    res.status(error.response.status).end(error.response.statusText)
  }
})

app.use(express.static('static'))

app.listen(port, () =>
  console.log(`launch http://localhost:${port} to explore`)
)
