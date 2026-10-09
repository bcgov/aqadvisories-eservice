module.exports = function (Bounce) {
  Bounce.beforeRemote('**', function (ctx, unused, next) {
    if (Bounce.isAdminReq(ctx, true)) {
      return next()
    }
    var error = new Error('Forbidden')
    error.status = 403
    return next(error)
  })
}
