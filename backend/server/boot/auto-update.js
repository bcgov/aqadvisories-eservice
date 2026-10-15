module.exports = function(app, cb) {
  if (process.env.NOTIFYBC_NODE_ROLE === 'slave') {
    return process.nextTick(cb)
  }
  const pjson = require('../../package.json')
  const semver = require('semver')
  const targetVersion = pjson.dbSchemaVersion
  app.models.Configuration.findOrCreate(
    { where: { name: 'dbSchemaVersion' } },
    {
      name: 'dbSchemaVersion',
      value: '0.0.0'
    },
    function(err, data) {
      const currentVersion = data.value
      if (
        semver.major(targetVersion) === semver.major(currentVersion) &&
        semver.minor(targetVersion) > semver.minor(currentVersion)
      ) {
        app.dataSources.db.autoupdate(function(err, result) {
          if (err) {
            throw err
          } else {
            data.updateAttribute('value', targetVersion)
            return cb()
          }
        })
      } else {
        return cb()
      }
    }
  )
}
