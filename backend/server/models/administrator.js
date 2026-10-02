module.exports = function(Administrator) {
  Administrator.beforeRemote('**', function(ctx, unused, next) {
    if (Administrator.isAdminReq(ctx, true)) {
      return next()
    }
    var error = new Error('Forbidden')
    error.status = 403
    return next(error)
  })
}
