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
const htmlToText = require('html-to-text')
const qs = require('qs')

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

app.post('/post/subscriptions', async (req, res) => {
  try {
    if (!req.body.token) {
      res.status(403).end()
    }
    const reCaptchaRes = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      qs.stringify({
        secret: process.env.recaptcha_secret,
        response: req.body.token
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    )
    if (
      !reCaptchaRes.data ||
      !reCaptchaRes.data.success ||
      reCaptchaRes.data.score < 0.5 ||
      reCaptchaRes.data.action !== 'submit'
    ) {
      res.status(403).end()
    }
    let data = {
      serviceName: 'envAirQuality',
      channel: 'email',
      city: req.body.city,
      userChannelId: req.body.userChannelId,
      data: {
        creator: { ip: req.ip }
      }
    }
    if (data.city) {
      if (data.city instanceof Array) {
        data.broadcastPushNotificationFilter = data.city
          .map(e => {
            return "contains(categories,'" + e + "')"
          })
          .join('||')
        data.data.citiesHtml = `<ul><li>${data.city.join(
          '</li><li>'
        )}</li></ul>`
        data.data.citiesText = `${data.city.join(', ')}`
        data.data.cities = data.city
      } else if (typeof data.city == 'string') {
        data.broadcastPushNotificationFilter = `contains(categories,'${data.city}')`
        data.data.citiesHtml = `<ul><li>${data.city}</li></ul>`
        data.data.citiesText = `${data.city}`
        data.data.cities = [data.city]
      }
      delete data.city
    }
    try {
      await axios.post(notifybcRootUrl + '/api/subscriptions', data)
      // send sms subscription if phone # is supplied
      if (req.body.phone) {
        data.channel = 'sms'
        data.userChannelId = req.body.phone
        await axios.post(notifybcRootUrl + '/api/subscriptions', data)
      }
      res.redirect('/subscription_sent.html')
    } catch (error) {
      res.status(error.response.status).end(error.response.statusText)
    }
  } catch (ex) {
    res.status(500).end(ex)
  }
})
app.post('/post/notifications', keycloak.protect(role), async (req, res) => {
  try {
    const htmlBody = req.body.message.htmlBody || ''
    const textBody = htmlToText.fromString(htmlBody)
    let data = {
      serviceName: 'envAirQuality',
      channel: 'email',
      isBroadcast: true,
      asyncBroadcastPushNotification: true,
      message: {
        from: 'BC Air Quality <donotreply@gov.bc.ca>',
        subject: req.body.message.subject,
        htmlBody: htmlBody,
        textBody: textBody
      },
      data: {
        categories: req.body.city
      }
    }
    if (typeof data.data.categories == 'string') {
      data.data.categories = [data.data.categories]
    }
    data.data.sender = {
      name: req.kauth.grant.access_token.content.name,
      email: req.kauth.grant.access_token.content.email
    }
    data.message.htmlBody = `${data.message.htmlBody}<a href="{unsubscription_url}">Unsubscribe from this service</a>`
    data.message.textBody =
      data.message.textBody +
      '\n\nTo unsubscribe from this service, open {unsubscription_url} in browser.'

    try {
      await axios.post(notifybcRootUrl + '/api/notifications', data)
      data.channel = 'sms'
      // fold subject into body for sms
      data.message.textBody = data.message.subject + '\n' + data.message.textBody
      await axios.post(notifybcRootUrl + '/api/notifications', data)
      res.redirect('/advisory_sent.html')
    } catch (error) {
      res.status(error.response.status).end(error.response.statusText)
    }
  } catch (ex) {
    res.status(500).end(ex)
  }
})

app.use(express.static('static'))

app.listen(port, () =>
  console.log(`launch http://localhost:${port} to explore`)
)
