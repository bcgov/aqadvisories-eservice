const queue = require('async/queue')
const parallel = require('async/parallel')
const disableAllMethods = require('../helpers.js').disableAllMethods
const _ = require('lodash')
const jmespath = require('jmespath')

module.exports = function (Notification) {
  Notification.request = require('axios')
  disableAllMethods(Notification, [
    'find',
    'create',
    'patchAttributes',
    'replaceById',
    'deleteItemById',
    'count',
  ])

  Notification.observe('access', function (ctx, next) {
    var httpCtx = ctx.options.httpContext
    ctx.query.where = ctx.query.where || {}
    var currUser = Notification.getCurrentUser(httpCtx)
    if (currUser) {
      ctx.query.where.channel = 'inApp'
      ctx.query.where.or = []
      ctx.query.where.or.push({
        isBroadcast: true,
      })
      ctx.query.where.or.push({
        userChannelId: currUser,
      })
    } else if (!Notification.isAdminReq(httpCtx)) {
      var error = new Error('Forbidden')
      error.status = 403
      return next(error)
    }
    next()
  })

  Notification.afterRemote('find', function (ctx, res, next) {
    if (!res) {
      return
    }
    var currUser = Notification.getCurrentUser(ctx)
    if (currUser) {
      ctx.result = res.reduce(function (p, e, i) {
        if (e.validTill && Date.parse(e.validTill) < new Date()) {
          return p
        }
        if (e.invalidBefore && Date.parse(e.invalidBefore) > new Date()) {
          return p
        }
        if (e.deletedBy && e.deletedBy.indexOf(currUser) >= 0) {
          return p
        }
        if (e.isBroadcast && e.readBy && e.readBy.indexOf(currUser) >= 0) {
          e.state = 'read'
        }
        if (e.isBroadcast) {
          e.readBy = null
          e.deletedBy = null
        }
        e.unsetAttribute('updatedBy')
        e.unsetAttribute('createdBy')
        p.push(e)
        return p
      }, [])
    }
    next()
  })

  Notification.preCreationValidation = function () {
    let ctx = arguments[0]
    let next = arguments[arguments.length - 1]
    let error
    if (!Notification.isAdminReq(ctx)) {
      error = new Error('Forbidden')
      error.status = 403
      return next(error)
    }

    var data = ctx.args.data
    if (
      !data.isBroadcast &&
      data.skipSubscriptionConfirmationCheck &&
      !data.userChannelId
    ) {
      error = new Error('invalid user')
      error.status = 403
      return next(error)
    }
    if (
      data.channel === 'inApp' ||
      data.skipSubscriptionConfirmationCheck ||
      data.isBroadcast
    ) {
      return next()
    }
    if (!data.userChannelId && !data.userId) {
      error = new Error('invalid user')
      error.status = 403
      return next(error)
    }
    // validate userChannelId/userId of a unicast push notification against subscription data
    var whereClause = {
      serviceName: data.serviceName,
      state: 'confirmed',
      channel: data.channel,
    }
    if (data.userChannelId) {
      // email address check should be case insensitive
      var escapedUserChannelId = data.userChannelId.replace(
        /[-[\]{}()*+?.,\\^$|#\s]/g,
        '\\$&'
      )
      var escapedUserChannelIdRegExp = new RegExp(escapedUserChannelId, 'i')
      whereClause.userChannelId = {
        regexp: escapedUserChannelIdRegExp,
      }
    }
    if (data.userId) {
      whereClause.userId = data.userId
    }

    Notification.app.models.Subscription.findOne(
      {
        where: whereClause,
      },
      function (err, subscription) {
        if (err || !subscription) {
          var error = new Error('invalid user')
          error.status = 403
          return next(error)
        } else {
          // in case request supplies userId instead of userChannelId
          data.userChannelId = subscription.userChannelId
          ctx.subscription = subscription
          return next()
        }
      }
    )
  }

  Notification.beforeRemote('create', Notification.preCreationValidation)
  Notification.beforeRemote('replaceById', Notification.preCreationValidation)

  Notification.dispatchNotification = function (ctx, res, next) {
    // send non-inApp notifications immediately
    switch (res.channel) {
      case 'email':
      case 'sms':
        if (res.invalidBefore && Date.parse(res.invalidBefore) > new Date()) {
          return next()
        }
        if (!res.httpHost && res.channel !== 'inApp') {
          res.httpHost = Notification.app.get('httpHost')
          if (!res.httpHost && ctx.req) {
            res.httpHost = ctx.req.protocol + '://' + ctx.req.get('host')
          }
        }
        sendPushNotification(ctx, res, function (errSend) {
          if (errSend) {
            res.state = 'error'
          } else if (res.isBroadcast && res.asyncBroadcastPushNotification) {
            // async
          } else {
            res.state = 'sent'
          }
          res.save(
            {
              httpContext: ctx,
            },
            function (errSave) {
              next(errSend || errSave)
            }
          )
        })
        break
      default:
        next()
        break
    }
  }
  Notification.afterRemote('create', Notification.dispatchNotification)
  Notification.afterRemote('replaceById', Notification.dispatchNotification)

  function beforePatchAttributes() {
    var ctx = arguments[0]
    var next = arguments[arguments.length - 1]
    if (ctx.method.name === 'deleteItemById') {
      ctx.args.data = {
        state: 'deleted',
      }
    }
    // only allow changing state for non-admin requests
    if (!Notification.isAdminReq(ctx)) {
      var currUser = Notification.getCurrentUser(ctx)
      if (!currUser) {
        var error = new Error('Forbidden')
        error.status = 403
        return next(error)
      }
      ctx.args.data = ctx.args.data.state
        ? {
            state: ctx.args.data.state,
          }
        : null
      if (ctx.instance.isBroadcast) {
        switch (ctx.args.data.state) {
          case 'read':
            ctx.args.data.readBy = ctx.instance.readBy || []
            if (ctx.args.data.readBy.indexOf(currUser) < 0) {
              ctx.args.data.readBy.push(currUser)
            }
            break
          case 'deleted':
            ctx.args.data.deletedBy = ctx.instance.deletedBy || []
            if (ctx.args.data.deletedBy.indexOf(currUser) < 0) {
              ctx.args.data.deletedBy.push(currUser)
            }
            break
        }
      }
      delete ctx.args.data.state
    }
    next()
  }

  function afterPatchAttributes() {
    var ctx = arguments[0]
    var next = arguments[arguments.length - 1]
    // don't return the update
    ctx.result = {}
    next()
  }

  Notification.beforeRemote('prototype.patchAttributes', beforePatchAttributes)
  Notification.afterRemote('prototype.patchAttributes', afterPatchAttributes)
  Notification.beforeRemote('prototype.deleteItemById', beforePatchAttributes)
  Notification.afterRemote('prototype.deleteItemById', afterPatchAttributes)
  Notification.prototype.deleteItemById = function (options, callback) {
    this.patchAttributes(options.httpContext.args.data, options, callback)
  }

  function sendPushNotification(ctx, data, cb) {
    const inboundSmtpServerDomain =
      Notification.app.get('inboundSmtpServer').domain ||
      Notification.app.get('subscription').unsubscriptionEmailDomain
    const handleBounce = Notification.app.get('notification').handleBounce
    const handleListUnsubscribeByEmail = Notification.app.get('notification')
      .handleListUnsubscribeByEmail

    function updateBounces(userChannelIds, data, cb) {
      if (!handleBounce) {
        return cb()
      }
      let userChannelIdQry = userChannelIds
      if (userChannelIds instanceof Array) {
        userChannelIdQry = {
          inq: userChannelIds,
        }
      }
      Notification.app.models.Bounce.updateAll(
        {
          state: 'active',
          channel: data.channel,
          userChannelId: userChannelIdQry,
          or: [
            {
              latestNotificationStarted: undefined,
            },
            {
              latestNotificationStarted: {
                lt: data.updated,
              },
            },
          ],
        },
        {
          latestNotificationStarted: data.updated,
          latestNotificationEnded: Date.now(),
        },
        cb
      )
    }

    switch (data.isBroadcast) {
      case false: {
        let tokenData = _.assignIn({}, ctx.subscription, {
          data: data.data,
        })
        var textBody =
          data.message.textBody &&
          Notification.mailMerge(data.message.textBody, tokenData, ctx)
        switch (data.channel) {
          case 'sms':
            Notification.sendSMS(data.userChannelId, textBody, tokenData, cb)
            break
          default:
            {
              var htmlBody =
                data.message.htmlBody &&
                Notification.mailMerge(data.message.htmlBody, tokenData, ctx)
              var subject =
                data.message.subject &&
                Notification.mailMerge(data.message.subject, tokenData, ctx)
              let unsubscriptUrl = Notification.mailMerge(
                '{unsubscription_url}',
                tokenData,
                ctx
              )
              let listUnsub = unsubscriptUrl
              if (handleListUnsubscribeByEmail && inboundSmtpServerDomain) {
                let unsubEmail =
                  Notification.mailMerge(
                    'un-{subscription_id}-{unsubscription_code}@',
                    tokenData,
                    ctx
                  ) + inboundSmtpServerDomain
                listUnsub = [[unsubEmail, unsubscriptUrl]]
              }
              let mailOptions = {
                from: data.message.from,
                to: data.userChannelId,
                subject: subject,
                text: textBody,
                html: htmlBody,
                list: {
                  id:
                    data.httpHost + '/' + encodeURIComponent(data.serviceName),
                  unsubscribe: listUnsub,
                },
              }
              if (handleBounce && inboundSmtpServerDomain) {
                let bounceEmail = Notification.mailMerge(
                  `bn-{subscription_id}-{unsubscription_code}@${inboundSmtpServerDomain}`,
                  tokenData,
                  ctx
                )
                mailOptions.envelope = {
                  from: bounceEmail,
                  to: data.userChannelId,
                }
              }
              Notification.sendEmail(mailOptions, (err) => {
                if (err) {
                  return cb(err)
                }
                updateBounces(data.userChannelId, data, cb)
              })
            }
            break
        }
        break
      }
      case true: {
        const broadcastSubscriberChunkSize = Notification.app.get(
          'notification'
        ).broadcastSubscriberChunkSize
        const broadcastSubRequestBatchSize = Notification.app.get(
          'notification'
        ).broadcastSubRequestBatchSize
        const logSuccessfulBroadcastDispatches = Notification.app.get(
          'notification'
        ).logSuccessfulBroadcastDispatches
        let startIdx = ctx.args.start
        let broadcastToChunkSubscribers = (broadcastToChunkSubscribersCB) => {
          Notification.app.models.Subscription.find(
            {
              where: {
                serviceName: data.serviceName,
                state: 'confirmed',
                channel: data.channel,
              },
              order: 'created ASC',
              skip: startIdx,
              limit: broadcastSubscriberChunkSize,
            },
            async function (err, subscribers) {
              let jmespathSearchOpts = {}
              const ft = Notification.app.get('notification')
                .broadcastCustomFilterFunctions
              if (ft) {
                jmespathSearchOpts.functionTable = ft
              }
              let tasks = []
              await Promise.all(
                subscribers.map(async (e) => {
                  if (e.broadcastPushNotificationFilter && data.data) {
                    let match
                    try {
                      match = await jmespath.search(
                        [data.data],
                        '[?' + e.broadcastPushNotificationFilter + ']',
                        jmespathSearchOpts
                      )
                    } catch (ex) {}
                    if (!match || match.length === 0) {
                      return
                    }
                  }
                  tasks.push(function (cb) {
                    var notificationMsgCB = function (err) {
                      let res = {}
                      if (err) {
                        res.fail = {
                          subscriptionId: e.id,
                          userChannelId: e.userChannelId,
                          error: err,
                        }
                      } else if (
                        logSuccessfulBroadcastDispatches ||
                        handleBounce
                      ) {
                        res.success = e.id
                      }
                      return cb(null, res)
                    }
                    let tokenData = _.assignIn({}, e, {
                      data: data.data,
                    })
                    var textBody =
                      data.message.textBody &&
                      Notification.mailMerge(
                        data.message.textBody,
                        tokenData,
                        ctx
                      )
                    switch (e.channel) {
                      case 'sms':
                        Notification.sendSMS(
                          e.userChannelId,
                          textBody,
                          tokenData,
                          notificationMsgCB
                        )
                        break
                      default: {
                        var subject =
                          data.message.subject &&
                          Notification.mailMerge(
                            data.message.subject,
                            tokenData,
                            ctx
                          )
                        var htmlBody =
                          data.message.htmlBody &&
                          Notification.mailMerge(
                            data.message.htmlBody,
                            tokenData,
                            ctx
                          )
                        let unsubscriptUrl = Notification.mailMerge(
                          '{unsubscription_url}',
                          tokenData,
                          ctx
                        )
                        let listUnsub = unsubscriptUrl
                        if (
                          handleListUnsubscribeByEmail &&
                          inboundSmtpServerDomain
                        ) {
                          let unsubEmail =
                            Notification.mailMerge(
                              'un-{subscription_id}-{unsubscription_code}@',
                              tokenData,
                              ctx
                            ) + inboundSmtpServerDomain
                          listUnsub = [[unsubEmail, unsubscriptUrl]]
                        }
                        let mailOptions = {
                          from: data.message.from,
                          to: e.userChannelId,
                          subject: subject,
                          text: textBody,
                          html: htmlBody,
                          list: {
                            id:
                              data.httpHost +
                              '/' +
                              encodeURIComponent(data.serviceName),
                            unsubscribe: listUnsub,
                          },
                        }
                        if (handleBounce && inboundSmtpServerDomain) {
                          let bounceEmail = Notification.mailMerge(
                            `bn-{subscription_id}-{unsubscription_code}@${inboundSmtpServerDomain}`,
                            tokenData,
                            ctx
                          )
                          mailOptions.envelope = {
                            from: bounceEmail,
                            to: e.userChannelId,
                          }
                        }
                        Notification.sendEmail(mailOptions, notificationMsgCB)
                      }
                    }
                  })
                })
              )
              parallel(tasks, function (err, resArr) {
                let ret = {
                  fail: [],
                  success: [],
                }
                for (res of resArr) {
                  if (res.fail) {
                    ret.fail.push(res.fail)
                  } else if (res.success) {
                    ret.success.push(res.success)
                  }
                }
                return (broadcastToChunkSubscribersCB || cb)(err, ret)
              })
            }
          )
        }
        if (typeof startIdx !== 'number') {
          let postBroadcastProcessing = function (postBroadcastProcessingCb) {
            Notification.app.models.Subscription.find(
              {
                fields: {
                  userChannelId: true,
                },
                where: {
                  id: {
                    inq: data.successfulDispatches,
                  },
                },
              },
              (err, res) => {
                let userChannelIds = res.map((e) => e.userChannelId)
                const errUserChannelIds = (data.failedDispatches || []).map(
                  (e) => e.userChannelId
                )
                _.pullAll(userChannelIds, errUserChannelIds)
                updateBounces(userChannelIds, data, postBroadcastProcessingCb)
              }
            )
          }
          let postBroadcastProcessingCb = function (err, res) {
            if (!logSuccessfulBroadcastDispatches) {
              delete data.successfulDispatches
            }
            if (!data.asyncBroadcastPushNotification) {
              cb()
            } else {
              if (data.state !== 'error') {
                data.state = 'sent'
              }
              data.save(
                {
                  httpContext: ctx,
                },
                function (errSave) {
                  if (typeof data.asyncBroadcastPushNotification === 'string') {
                    let options = {
                      headers: {
                        'Content-Type': 'application/json',
                      },
                    }
                    Notification.request.post(
                      data.asyncBroadcastPushNotification,
                      data,
                      options
                    )
                  }
                }
              )
            }
          }
          Notification.app.models.Subscription.count(
            {
              serviceName: data.serviceName,
              state: 'confirmed',
              channel: data.channel,
            },
            function (err, count) {
              if (count <= broadcastSubscriberChunkSize) {
                startIdx = 0
                broadcastToChunkSubscribers((err, res) => {
                  if (res.fail) {
                    data.failedDispatches = res.fail
                  }
                  if (res.success) {
                    data.successfulDispatches = res.success
                  }
                  postBroadcastProcessing(postBroadcastProcessingCb)
                })
              } else {
                // call broadcastToChunkSubscribers, coordinate output
                let chunks = Math.ceil(count / broadcastSubscriberChunkSize)
                let httpHost = Notification.app.get('internalHttpHost')
                const restApiRoot = Notification.app.get('restApiRoot')
                if (!httpHost) {
                  httpHost =
                    data.httpHost ||
                    ctx.req.protocol + '://' + ctx.req.get('host')
                }

                let q = queue(function (task, cb) {
                  let uri =
                    httpHost +
                    restApiRoot +
                    '/notifications/' +
                    data.id +
                    '/broadcastToChunkSubscribers?start=' +
                    task.startIdx
                  Notification.request
                    .get(uri)
                    .then(function (response) {
                      const body = response.data
                      if (response.status === 200) {
                        return cb && cb(null, body)
                      }
                      throw new Error(response.status)
                    })
                    .catch(function (error) {
                      Notification.app.models.Subscription.find(
                        {
                          where: {
                            serviceName: data.serviceName,
                            state: 'confirmed',
                            channel: data.channel,
                          },
                          order: 'created ASC',
                          skip: task.startIdx,
                          limit: broadcastSubscriberChunkSize,
                          fields: {
                            userChannelId: true,
                          },
                        },
                        function (err, subs) {
                          return (
                            cb &&
                            cb(err, subs && subs.map((e) => e.userChannelId))
                          )
                        }
                      )
                    })
                }, broadcastSubRequestBatchSize)
                q.drain(function () {
                  postBroadcastProcessing(postBroadcastProcessingCb)
                })
                let queuedTasks = [],
                  i = 0
                while (i < chunks) {
                  queuedTasks.push({
                    startIdx: i * broadcastSubscriberChunkSize,
                  })
                  i++
                }
                q.push(queuedTasks, function (err, res) {
                  if (err) {
                    data.state = 'error'
                    return
                  }
                  if (res.success && res.success.length > 0) {
                    data.successfulDispatches = (
                      data.successfulDispatches || []
                    ).concat(res.success)
                  }
                  let failedDispatches = res.fail || res || []
                  if (failedDispatches instanceof Array) {
                    if (failedDispatches.length <= 0) {
                      return
                    }
                    data.failedDispatches = (
                      data.failedDispatches || []
                    ).concat(failedDispatches)
                  } else {
                    data.state = 'error'
                  }
                })
              }
            }
          )
          if (data.asyncBroadcastPushNotification) {
            cb(null)
          }
        } else {
          broadcastToChunkSubscribers()
        }
        break
      }
    }
  }

  /**
   * dispatch broadcast notifications to a chunk of subscribers
   * @param {number} start start index
   * @param {Function(Error, array)} callback
   */

  Notification.prototype.broadcastToChunkSubscribers = function (
    options,
    start,
    callback
  ) {
    sendPushNotification(options.httpContext, this, (err, data) => {
      callback(err, data)
    })
  }
}
