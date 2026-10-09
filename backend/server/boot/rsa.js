const fs = require('fs')
const path = require('path')
var NodeRSA = require('node-rsa')

module.exports = function (app, cb) {
  /*
   * The `app` object provides access to a variety of LoopBack resources such as
   * models (e.g. `app.models.YourModelName`) or data sources (e.g.
   * `app.datasources.YourDataSource`). See
   * http://docs.strongloop.com/display/public/LB/Working+with+LoopBack+objects
   * for more info.
   */

  +(function getRSAKey() {
    app.models.Configuration.findOne({
        where: {
          name: 'rsa'
        }
      },
      (err, data) => {
        var key = new NodeRSA()
        if (!err && data) {
          key.importKey(data.value.private, 'private')
          key.importKey(data.value.public, 'public')
          module.exports.key = key
          return cb()
        }
        if (process.env.NOTIFYBC_NODE_ROLE === 'slave') {
          return setTimeout(getRSAKey, 5000)
        }
        // only the node with cron enabled, which is supposed to be a singleton,
        // can generate RSA key pair by executing code below
        key.generateKeyPair()
        module.exports.key = key
        app.models.Configuration.create({
            name: 'rsa',
            value: {
              private: key.exportKey('private'),
              public: key.exportKey('public')
            }
          },
          function (err, data) {
            return cb()
          }
        )
      }
    )
  })()
}
