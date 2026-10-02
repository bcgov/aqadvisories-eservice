module.exports = function (app, cb) {
  const smtpSvr = app.get('inboundSmtpServer')
  if (!smtpSvr.enabled) {
    return process.nextTick(cb)
  }
  return require('../smtp-server').app(app, cb)
}
