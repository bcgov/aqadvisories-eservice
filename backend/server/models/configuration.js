var disableAllMethods = require('../../common/helpers.js').disableAllMethods
module.exports = function (Configuration) {
  disableAllMethods(Configuration, [
    'find',
    'create',
    'patchAttributes',
    'replaceById',
    'deleteById',
    'count'
  ])
  Configuration.beforeRemote('**', function (ctx, unused, next) {
    if (Configuration.isAdminReq(ctx, true)) {
      return next()
    }
    var error = new Error('Forbidden')
    error.status = 403
    return next(error)
  })

  Configuration.observe('before save', function () {
    let ctx = arguments[0]
    let next = arguments[arguments.length - 1]
    try {
      let data
      if (ctx.instance) {
        data = ctx.instance
      } else if (ctx.data) {
        data = ctx.data
      }
      if (
        data.name === 'notification' &&
        data.value &&
        data.value.rss &&
        !data.value.httpHost &&
        !Configuration.app.get('httpHost')
      ) {
        let httpCtx = ctx.options.httpContext
        data.value.httpHost = httpCtx.req.protocol + '://' + httpCtx.req.get('host')
      }
    } catch (ex) { }
    next()
  })
}
