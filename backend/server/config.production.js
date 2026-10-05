// loaded by loopback-boot when NODE_ENV=production and merged over config.json.
//
// Inbound SMTP (list-unsubscribe by email and bounce handling) is off unless
// INBOUND_SMTP_DOMAIN is set. Setting it also changes every outgoing email: the
// List-Unsubscribe header and the envelope sender (bn-...@<domain>) use that domain,
// so set it only once its MX record reaches the TCP proxy in front of the SMTP Route
// (see backend/openshift.deploy.yml).
const inboundSmtpDomain = process.env.INBOUND_SMTP_DOMAIN

module.exports = {
  adminIps: ['127.0.0.1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
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
