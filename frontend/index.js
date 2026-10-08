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
// same module the subscription form loads in the browser, so client and server
// enforce one definition of a valid sms number
const nanp = require('./static/js/nanp')
// NotifyBC treats requests from this app as admin (adminIps). Public, pass-through
// endpoints send this so NotifyBC applies its anonymous-user checks instead.
const anonymousRequest = { headers: { is_anonymous: 'true' } }

app.get('/ping', (req, res) => res.send('ok'))

const storeOptions = { logFn: () => {} }
if (process.env.file_store_path) {
  storeOptions.path = process.env.file_store_path
}
var store = new FileStore(storeOptions)

// keycloak.json: the committed file holds local defaults; on OpenShift it is replaced by
// the environment's ConfigMap copy (see openshift.deploy.yml). These env vars can still
// override its SSO server/realm/client.
const keycloakConfig = require('./keycloak.json')
if (process.env.keycloak_auth_server_url) {
  keycloakConfig['auth-server-url'] = process.env.keycloak_auth_server_url
}
if (process.env.keycloak_realm) {
  keycloakConfig.realm = process.env.keycloak_realm
}
if (process.env.keycloak_client_id) {
  keycloakConfig.resource = process.env.keycloak_client_id
}
const keycloak = new Keycloak({ store: store, idpHint: 'idir' }, keycloakConfig)
if (process.env.trust_proxy) {
  app.set('trust proxy', process.env.trust_proxy)
}
app.use(
  session({
    name: 'aqaess',
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    store: store,
  })
)
app.use(keycloak.middleware())
app.use(bodyParser.urlencoded({ extended: true }))
app.get('/admin.html', keycloak.protect())
app.get('/stats.html', keycloak.protect())

// PR environments only (recaptcha_disabled=true from pr-open.yml): their hostnames aren't on
// the site key's domain list, so Google rejects every token there ("browser-error").
const recaptchaDisabled = process.env.recaptcha_disabled === 'true'
if (recaptchaDisabled) {
  console.warn('reCAPTCHA verification is DISABLED: subscription forms are not bot-checked')
}

// true when Google accepts the form's reCAPTCHA v3 token as a human "submit"
async function recaptchaPassed(token) {
  if (!token) {
    console.warn('Subscription rejected: no reCAPTCHA token in the form post')
    return false
  }
  const reCaptchaRes = await axios.post(
    'https://www.google.com/recaptcha/api/siteverify',
    qs.stringify({
      secret: process.env.recaptcha_secret,
      response: token,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )
  if (
    !reCaptchaRes.data ||
    !reCaptchaRes.data.success ||
    reCaptchaRes.data.score < 0.5 ||
    reCaptchaRes.data.action !== 'submit'
  ) {
    // e.g. error-codes "missing-input-secret" (recaptcha_secret unset) or
    // "invalid-input-secret" (wrong key), a low score, or the wrong hostname
    const { success, score, action, hostname } = reCaptchaRes.data || {}
    console.warn('Subscription rejected by reCAPTCHA:', {
      success,
      score,
      action,
      hostname,
      errorCodes: reCaptchaRes.data && reCaptchaRes.data['error-codes'],
      secretConfigured: Boolean(process.env.recaptcha_secret),
    })
    return false
  }
  return true
}

app.post('/post/subscriptions', async (req, res) => {
  try {
    if (!recaptchaDisabled && !(await recaptchaPassed(req.body.token))) {
      return res.status(403).end()
    }
    // Validate the sms number up front, so an invalid one never leaves behind a
    // half-completed submission with the email subscription already created.
    const rawPhone =
      typeof req.body.phone === 'string' ? req.body.phone.trim() : ''
    // the input mask can leave a stray separator behind when the field is cleared
    const phoneSupplied = /[0-9]/.test(rawPhone)
    const phone = phoneSupplied ? nanp.normalize(rawPhone) : null
    if (phoneSupplied && !phone) {
      return res
        .status(400)
        .end(
          'Please enter a valid 10-digit mobile phone number in the format ###-###-####.'
        )
    }
    const data = {
      serviceName: 'envAirQuality',
      channel: 'email',
      city: req.body.city,
      userChannelId: req.body.userChannelId,
      data: {
        creator: { ip: req.ip },
      },
    }
    if (data.city) {
      if (data.city instanceof Array) {
        data.broadcastPushNotificationFilter = data.city
          .map((e) => {
            return "contains(categories,'" + e + "')"
          })
          .join('||')
        data.data.citiesHtml = `<ul><li>${data.city.join(
          '</li><li>'
        )}</li></ul>`
        data.data.citiesText = `${data.city.join(', ')}`
        data.data.cities = data.city
      } else if (typeof data.city === 'string') {
        data.broadcastPushNotificationFilter = `contains(categories,'${data.city}')`
        data.data.citiesHtml = `<ul><li>${data.city}</li></ul>`
        data.data.citiesText = `${data.city}`
        data.data.cities = [data.city]
      }
      delete data.city
    }
    try {
      if (req.body.userChannelId) {
        await axios.post(notifybcRootUrl + '/api/subscriptions', data)
      }
      // send sms subscription if a valid phone # is supplied
      if (phone) {
        data.channel = 'sms'
        data.userChannelId = phone
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
app.post('/post/notifications', keycloak.protect(), async (req, res) => {
  try {
    const htmlBody = req.body.message.htmlBody || ''
    const smsBody = req.body.message.smsBody || ''
    const textBody = htmlToText.fromString(htmlBody)
    const data = {
      serviceName: 'envAirQuality',
      channel: 'email',
      isBroadcast: true,
      asyncBroadcastPushNotification: true,
      message: {
        from: 'BC Air Quality <donotreply@gov.bc.ca>',
        subject: req.body.message.subject,
        htmlBody: htmlBody,
        textBody: textBody,
      },
      data: {
        categories: req.body.city,
      },
    }
    if (typeof data.data.categories === 'string') {
      data.data.categories = [data.data.categories]
    }
    data.data.sender = {
      name: req.kauth.grant.access_token.content.name,
      email: req.kauth.grant.access_token.content.email,
    }
    data.message.htmlBody = `${data.message.htmlBody}<a href="{unsubscription_url}">Unsubscribe from this service</a>`
    data.message.textBody =
      data.message.textBody +
      '\n\nTo unsubscribe, open {unsubscription_url} in browser.'

    try {
      await axios.post(notifybcRootUrl + '/api/notifications', data)
      data.channel = 'sms'
      if (smsBody.trim().length > 0) {
        data.message.textBody =
          smsBody +
          '\n\nReply ' +
          process.env.swift_unsubscription_keyword +
          ' to unsubscribe.'
        await axios.post(notifybcRootUrl + '/api/notifications', data)
      }
      res.redirect('/advisory_sent.html')
    } catch (error) {
      res.status(error.response.status).end(error.response.statusText)
    }
  } catch (ex) {
    res.status(500).end(ex)
  }
})

app.delete('/unsubscribe/:subscriptionId/:unsubscriptionCode', async (req, res) => {
  const { subscriptionId, unsubscriptionCode } = req.params;

  const isValidId = subscriptionId && /^[a-zA-Z0-9]+$/.test(subscriptionId); // numbers and letters
  const isValidCode = unsubscriptionCode && /^\d+$/.test(unsubscriptionCode); // numbers

  if (!subscriptionId || !unsubscriptionCode || !isValidId || !isValidCode) {
    return res.status(400).json({ error: 'Invalid subscriptionId or unsubscriptionCode' });
  }

  try {
    const unsubscribeUrl = `${notifybcRootUrl}/api/subscriptions/${subscriptionId}?unsubscriptionCode=${unsubscriptionCode}&additionalServices=_all`;
    // is_anonymous: this app's IP is an admin IP in NotifyBC, and admin requests skip
    // the unsubscriptionCode check; the header makes NotifyBC treat this as the public user
    const notifyResponse = await axios.delete(unsubscribeUrl, anonymousRequest);
    res.status(200).json({ message: 'Unsubscription successful' });
  } catch (error) {
    console.error('Unsubscription failed:', error.response ? error.response.data : error.message);
    const status = error.response ? error.response.status : 500;
    const message = error.response ? error.response.data : 'Internal server error during unsubscription';
    res.status(status).json({ error: message });
  }
});

app.get('/resubscribe/:subscriptionId/:unsubscriptionCode', async (req, res) => {
  const { subscriptionId, unsubscriptionCode } = req.params;

  const isValidId = subscriptionId && /^[a-zA-Z0-9]+$/.test(subscriptionId); // numbers and letters
  const isValidCode = unsubscriptionCode && /^\d+$/.test(unsubscriptionCode); // numbers

  if (!subscriptionId || !unsubscriptionCode || !isValidId || !isValidCode) {
    return res.status(400).json({ error: 'Invalid subscriptionId or unsubscriptionCode' });
  }

  try {
    const resubscribeUrl = `${notifybcRootUrl}/api/subscriptions/${subscriptionId}/unsubscribe/undo?unsubscriptionCode=${unsubscriptionCode}`;
    const notifyResponse = await axios.get(resubscribeUrl, anonymousRequest);
    res.status(200).json({ message: 'Resubscription successful' });
  } catch (error) {
    console.log(error)
    console.error('Resubscription failed:', error.response ? error.response.data : error.message);
    const status = error.response ? error.response.status : 500;
    const message = error.response ? error.response.data : 'Internal server error during resubscription';
    res.status(status).json({ error: message });
  }
})

app.use(express.static('static'))

app.listen(port, () =>
  console.log(`launch http://localhost:${port} to explore`)
)
