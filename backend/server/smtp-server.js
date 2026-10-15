let server
module.exports.request = require('axios')
module.exports.mailParser = require('mailparser')
module.exports.app = function () {
  let app, cb
  if (arguments.length > 0) {
    if (arguments[0] instanceof Object) {
      app = arguments[0]
    }
    if (arguments[arguments.length - 1] instanceof Function) {
      cb = arguments[arguments.length - 1]
    }
  }

  if (server) {
    return cb && process.nextTick(cb.bind(null, null, server))
  }
  let urlPrefix = process.env.API_URL_PREFIX || 'http://localhost:3000/api'
  let port = process.env.LISTENING_SMTP_PORT || 0
  let allowedSmtpDomains = (process.env.ALLOWED_SMTP_DOMAINS &&
    process.env.ALLOWED_SMTP_DOMAINS
    .split(',')
    .map(e => e.trim().toLowerCase()))
  let bounceUnsubThreshold = parseInt(process.env.BOUNCE_UNSUBSCRIBE_THRESHOLD || 5)
  let smtpOptsString = process.env.SMTP_SERVER_OPTIONS
  let smtpOpts = (smtpOptsString && JSON.parse(smtpOptsString)) || {}
  let handleBounce = process.env.SMTP_HANDLE_BOUNCE
  let bounceSubjectRegex = process.env.BOUNCE_SUBJECT_REGEX &&
    new RegExp(process.env.BOUNCE_SUBJECT_REGEX)
  let bounceSmtpStatusCodeRegex = process.env.BOUNCE_SMTP_STATUS_CODE_REGEX &&
    new RegExp(process.env.BOUNCE_SMTP_ERROR_CODE_REGEX)
  let bounceFailedRecipientRegex = process.env.BOUNCE_FAILED_RECIPIENT_REGEX &&
    new RegExp(process.env.BOUNCE_FAILED_RECIPIENT_REGEX)

  if (app) {
    const smtpSvr = app.get('inboundSmtpServer')
    const notificationCfg = app.get('notification')
    const internalHttpHost = app.get('internalHttpHost')
    if (internalHttpHost) {
      urlPrefix = internalHttpHost + app.get('restApiRoot')
    }
    smtpSvr.listeningSmtpPort && (port = smtpSvr.listeningSmtpPort)
    smtpSvr.domain && (allowedSmtpDomains = smtpSvr.domain.split(',')
      .map(e => e.trim().toLowerCase()))
    smtpSvr.options && (smtpOpts = smtpSvr.options)
    if (notificationCfg.handleBounce !== undefined) {
      handleBounce = notificationCfg.handleBounce
    }
    bounceUnsubThreshold = smtpSvr.bounce.unsubThreshold
    if (smtpSvr.bounce.subjectRegex && smtpSvr.bounce.subjectRegex.length > 0) {
      bounceSubjectRegex = new RegExp(smtpSvr.bounce.subjectRegex)
    }
    bounceSmtpStatusCodeRegex = new RegExp(smtpSvr.bounce.smtpStatusCodeRegex)
    if (smtpSvr.bounce.failedRecipientRegex && smtpSvr.bounce.failedRecipientRegex.length > 0) {
      bounceFailedRecipientRegex = new RegExp(smtpSvr.bounce.failedRecipientRegex)
    }
  }
  if (require.main === module) {
    const getOpt = require('node-getopt')
      .create([
        [
          'a',
          'api-url-prefix=<string>',
          'NotifyBC api url prefix; default to http://localhost:3000/api'
        ],
        [
          'd',
          'allowed-smtp-domains=<string>+',
          'allowed recipient email domains; if missing all are allowed; repeat the option to create multiple entries.'
        ],
        [
          'p',
          'listening-smtp-port=<integer>',
          'if missing a random free port is chosen. Proxy is required if port is not 25.'
        ],
        [
          'b',
          'handle-bounce=<true|false>',
          'whether to enable bounce handling or not.'
        ],
        [
          'B',
          'bounce-unsubscribe-threshold=<integer>',
          'bounce count threshold above which unsubscribe all.'
        ],
        [
          's',
          'bounce-subject-regex=<string>',
          'bounce email subject regex'
        ],
        [
          'r',
          'bounce-smtp-status-code-regex=<string>',
          'bounce smtp status code regex'
        ],
        [
          'R',
          'bounce-failed-recipient-regex=<string>',
          'bounce failed recipient regex'
        ],
        ['o', 'smtp-server-options', 'stringified json smtp server options'],
        ['h', 'help', 'display this help']
      ])
      .bindHelp(
        'Usage: node ' + process.argv[1] + ' [Options]\n[Options]:\n[[OPTIONS]]'
      )
    const args = getOpt.parseSystem()
    args.options['api-url-prefix'] && (urlPrefix = args.options['api-url-prefix'])
    args.options['listening-smtp-port'] && (port = args.options['listening-smtp-port'])
    args.options['allowed-smtp-domains'] && (allowedSmtpDomains =
      args.options['allowed-smtp-domains'].map(e => e.toLowerCase()))
    args.options['bounce-unsubscribe-threshold'] && (bounceUnsubThreshold = parseInt(args.options['bounce-unsubscribe-threshold']))
    args.options['smtp-server-options'] && (smtpOpts = JSON.parse(args.options['smtp-server-options']))
    args.options['handle-bounce'] && (handleBounce = args.options['handle-bounce'] == 'true')
    args.options['bounce-subject-regex'] && (bounceSubjectRegex = new RegExp(args.options['bounce-subject-regex']))
    args.options['bounce-smtp-status-code-regex'] && (bounceSmtpStatusCodeRegex = new RegExp(args.options['bounce-smtp-status-code-regex']))
    args.options['bounce-failed-recipient-regex'] && (bounceFailedRecipientRegex = new RegExp(args.options['bounce-failed-recipient-regex']))
  }
  const SMTPServer = require('smtp-server').SMTPServer
  const validEmailRegEx = /(un|bn)-(.+?)-(.*)@(.+)/
  const _ = require('lodash')
  const MaxMsgSize = 1000000
  smtpOpts = _.assign({}, smtpOpts, {
    authOptional: true,
    disabledCommands: ['AUTH'],
    size: MaxMsgSize,
    onRcptTo(address, session, callback) {
      try {
        let match = address.address.match(validEmailRegEx)
        if (match) {
          let domain = match[4]
          if (!allowedSmtpDomains ||
            allowedSmtpDomains.indexOf(domain.toLowerCase()) >= 0
          )
            return callback()
        }
      } catch (ex) {}
      return callback(new Error('invalid recipient'))
    },
    onData(stream, session, callback) {
      stream.setEncoding('utf8')
      let msg = ''
      stream.on('data', chunk => {
        if (msg.length < MaxMsgSize) {
          msg += chunk
        }
      })
      stream.on('end', async () => {
        for (const e of session.envelope.rcptTo) {
          let match = e.address.match(validEmailRegEx)
          let type = match[1]
          let id = match[2]
          let unsubscriptionCode = match[3]
          switch (type) {
            case 'un':
              exports.request.get(
                urlPrefix +
                '/subscriptions/' +
                id +
                '/unsubscribe?unsubscriptionCode=' +
                encodeURIComponent(unsubscriptionCode) +
                '&userChannelId=' +
                encodeURIComponent(session.envelope.mailFrom.address), {
                  headers: {
                    /*jshint camelcase: false */
                    is_anonymous: true
                  }
                })
              break
            case 'bn':
              {
                if (!handleBounce) {
                  break
                }
                let parsed = {}
                try {
                  parsed = await exports.mailParser.simpleParser(msg)
                } catch (err) {
                  console.error(err)
                  let error = new Error("parsing error")
                  error.responseCode = 451
                  return callback(error)
                }
                let incrementBounctCnt = true
                if (incrementBounctCnt && bounceSubjectRegex && (!parsed.subject ||
                    !parsed.subject.match(bounceSubjectRegex))) {
                  console.info(`subject doesn't match filter`)
                  incrementBounctCnt = false
                }
                let smtpBody = parsed.html || parsed.text
                if (parsed.attachments && parsed.attachments.length > 0) {
                  let deliveryStatusAttachment = parsed.attachments.find(e => {
                    return e.contentType && e.contentType.toLowerCase() ===
                      'message/delivery-status'
                  })
                  if (deliveryStatusAttachment && deliveryStatusAttachment.content) {
                    smtpBody = deliveryStatusAttachment.content.toString('utf8')
                  }
                }
                if (incrementBounctCnt && (!smtpBody ||
                    !smtpBody.match(bounceSmtpStatusCodeRegex))) {
                  console.info(`smtp status code doesn't match filter`)
                  incrementBounctCnt = false
                }
                let bouncedUserChannelId
                if (bounceFailedRecipientRegex) {
                  let bouncedUserChannelIdMatch = smtpBody.match(bounceFailedRecipientRegex)
                  if (bouncedUserChannelIdMatch) {
                    bouncedUserChannelId = bouncedUserChannelIdMatch[0]
                  }
                }
                const xfr = parsed.headers && parsed.headers.get('x-failed-recipients')
                if (xfr) {
                  bouncedUserChannelId = xfr
                }
                let filter = {
                  where: {
                    id: id,
                    channel: 'email',
                    state: 'confirmed',
                    unsubscriptionCode: unsubscriptionCode,
                  }
                }
                let body
                try {
                  let res = await exports.request.get(urlPrefix +
                    '/subscriptions?filter=' +
                    encodeURIComponent(JSON.stringify(filter))
                  )
                  body = res.data
                } catch (err) {
                  return console.error(err)
                }
                if (!(body instanceof Array) || body.length !== 1) {
                  return
                }
                let userChannelId = body[0] && body[0].userChannelId
                if (incrementBounctCnt && bouncedUserChannelId &&
                  userChannelId !== bouncedUserChannelId) {
                  console.info(`userChannelId ${userChannelId} mismatches bouncedUserChannelId ${bouncedUserChannelId}`)
                  incrementBounctCnt = false
                }
                filter = {
                  where: {
                    channel: 'email',
                    state: 'active',
                    userChannelId: userChannelId
                  }
                }
                try {
                  let res = await exports.request.get(
                    urlPrefix +
                    '/bounces?filter=' +
                    encodeURIComponent(JSON.stringify(filter))
                  )
                  body = res.data
                } catch (err) {
                  return console.error(err)
                }
                let bncCnt = (body && body[0] && body[0].hardBounceCount) || 0,
                  bncId = body && body[0] && body[0].id,
                  bounceMessages = (body && body[0] && body[0].bounceMessages) || []
                if (incrementBounctCnt) {
                  bncCnt += 1
                }
                bounceMessages.unshift({
                  date: Date.now(),
                  message: msg
                })
                // upsert bounce
                if (bncId) {
                  await exports.request.patch(
                    urlPrefix +
                    '/bounces/' + bncId, {
                      hardBounceCount: bncCnt,
                      bounceMessages: bounceMessages
                    }
                  )
                } else {
                  let res = await exports.request.post(urlPrefix + '/bounces', {
                    channel: "email",
                    userChannelId: userChannelId,
                    hardBounceCount: bncCnt,
                    bounceMessages: bounceMessages
                  })
                  bncId = res.data.id
                }
                // unsub user
                if (bncCnt > bounceUnsubThreshold) {
                  await exports.request.get(
                    urlPrefix +
                    '/subscriptions/' +
                    id +
                    '/unsubscribe?unsubscriptionCode=' +
                    encodeURIComponent(unsubscriptionCode) +
                    '&userChannelId=' +
                    encodeURIComponent(userChannelId) + "&additionalServices=_all", {
                      headers: {
                        /*jshint camelcase: false */
                        is_anonymous: true
                      },
                      maxRedirects: 0,
                      validateStatus: function (status) {
                        return status >= 200 && status < 400
                      },
                    })
                  await exports.request.patch(
                    urlPrefix +
                    '/bounces/' + bncId, {
                      state: 'deleted'
                    }
                  )
                }
                break
              }
          }
        }
        return callback(null)
      })
    }
  })
  server = new SMTPServer(smtpOpts)
  server.listen(parseInt(port), function () {
    console.info(
      `smtp server started listening on port ${this.address()
        .port}  with:\napi-url-prefix=${urlPrefix}`
    )
    allowedSmtpDomains &&
      console.info(`allowed-smtp-domains=${allowedSmtpDomains}`)
    cb && cb(null, server)
  })
}
if (require.main === module) {
  module.exports.app()
}
