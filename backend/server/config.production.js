// loaded by loopback-boot when NODE_ENV=production and merged over config.json and
// config.local.js (mounted from the notify-bc ConfigMap, see backend/openshift.deploy.yml).
//
// Inbound SMTP (list-unsubscribe by email and bounce handling) is off unless
// INBOUND_SMTP_DOMAIN is set. Setting it also changes every outgoing email: the
// List-Unsubscribe header and the envelope sender (bn-...@<domain>) use that domain,
// so set it only once its MX record reaches the TCP proxy in front of the SMTP Route.
const fs = require('fs')
const path = require('path')

const inboundSmtpDomain = process.env.INBOUND_SMTP_DOMAIN
const internalHttpHost = process.env.INTERNAL_HTTP_HOST
const gcnotifyAccountKey = process.env.GCNOTIFY_ACCOUNT_KEY
const gcnotifyBaseUrl = process.env.GCNOTIFY_BASE_URL

const config = {
  inboundSmtpServer: inboundSmtpDomain
    ? {
      enabled: true,
      domain: inboundSmtpDomain,
      listeningSmtpPort: parseInt(process.env.LISTENING_SMTP_PORT || '2525'),
      // implicit TLS: the passthrough Route routes by SNI, so the proxy connects over TLS
      // (smtp-server's built-in self-signed certificate; the proxy skips verification)
      options: {
        secure: true
      }
    }
    : {
      enabled: false
    }
}

// loopback-boot merges arrays item by item and fails on a length mismatch, so only
// supply adminIps when config.local.js (which sets its own list) is absent
if (!fs.existsSync(path.join(__dirname, 'config.local.js'))) {
  config.adminIps = ['127.0.0.1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']
}

// requests NotifyBC sends to itself (broadcast chunks, inbound SMTP) go to this
// environment's Service instead of config.local.js's httpHost (the public URL)
if (internalHttpHost) {
  config.internalHttpHost = internalHttpHost
}

// GC Notify SMS settings: the key from the ${NAME}-${ZONE}-backend Secret, the base URL
// from the GCNOTIFY_BASE_URL template parameter. When empty, the values in
// config.local.js (notify-bc ConfigMap) still apply.
const gcnotify = {}
if (gcnotifyAccountKey) {
  gcnotify.accountKey = gcnotifyAccountKey
}
if (gcnotifyBaseUrl) {
  gcnotify.baseUrl = gcnotifyBaseUrl
}
if (Object.keys(gcnotify).length > 0) {
  config.sms = { gcnotify }
}

module.exports = config
