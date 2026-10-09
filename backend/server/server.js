let app
module.exports = function (cb) {
  if (app) {
    return cb && process.nextTick(cb.bind(null, null, app))
  }
  var loopback = require('loopback')
  var boot = require('loopback-boot')

  app = loopback()
  app.use(loopback.token())
  app.start = function () {
    if (process.env.NOTIFYBC_NODE_ROLE !== 'slave') {
      var CronJob = require('cron').CronJob
      var cronTasks = require('./cron-tasks')
      var cronConfig = app.get('cron') || {}
      // start purgeData cron
      var cronConfigPurgeData = cronConfig.purgeData || {}
      new CronJob({
        cronTime: cronConfigPurgeData.timeSpec,
        onTick: function () {
          cronTasks.purgeData(app)
        },
        start: true
      })
      // start dispatchLiveNotifications cron
      var cronConfigDispatchLiveNotifications =
        cronConfig.dispatchLiveNotifications || {}
      new CronJob({
        cronTime: cronConfigDispatchLiveNotifications.timeSpec,
        onTick: function () {
          cronTasks.dispatchLiveNotifications(app)
        },
        start: true
      })
      // start checkRssConfigUpdates cron
      var cronConfigCheckRssConfigUpdates =
        cronConfig.checkRssConfigUpdates || {}
      new CronJob({
        cronTime: cronConfigCheckRssConfigUpdates.timeSpec,
        onTick: function () {
          cronTasks.checkRssConfigUpdates(app)
        },
        start: true
      })
      // start deleteBounces cron
      let deleteBounces =
        cronConfig.deleteBounces || {}
      new CronJob({
        cronTime: deleteBounces.timeSpec,
        onTick: function () {
          cronTasks.deleteBounces(app)
        },
        start: true
      })
    }

    app.set('trust proxy', app.get('trustedReverseProxyIps'))
    // start the web server
    return app.listen(function () {
      // without following line, node.js closes socket after 2min
      this.setTimeout(0)
      app.emit('started')
      var baseUrl = app.get('url').replace(/\/$/, '')
      console.log('Web server listening at: %s', baseUrl)
      // if (app.get('loopback-component-explorer')) {
      //   var explorerPath = app.get('loopback-component-explorer').mountPath
      //   console.log('Browse your REST API at %s%s', baseUrl, explorerPath)
      // }
      cb && cb(null, app)
    })
  }

  // Bootstrap the application, configure models, datasources and middleware.
  // Sub-apps like REST API are mounted via boot scripts.
  boot(app, __dirname, function (err) {
    if (err && cb) {
      return cb(err)
    }
    if (err) throw err

    // start the server if `$ node server.js`
    if (require.main === module) {
      return app.start()
    }
    cb && cb(null, app)
  })
}
if (require.main === module) {
  let numWorkers = parseInt(process.env.NOTIFYBC_WORKER_PROCESS_COUNT)
  if (isNaN(numWorkers)) {
    numWorkers = require('os').cpus().length
  }
  if (numWorkers < 2) {
    return module.exports()
  }

  const cluster = require('cluster')
  if (cluster.isMaster) {
    console.log(`# of worker processes = ${numWorkers}`)
    console.log(`Master ${process.pid} is running`)
    let masterWorker
    // Fork workers.
    for (let i = 0; i < numWorkers; i++) {
      if (i > 0) {
        cluster.fork({
          NOTIFYBC_NODE_ROLE: 'slave'
        })
      } else {
        masterWorker = cluster.fork()
      }
    }

    cluster.on('exit', (worker, code, signal) => {
      console.log(`worker ${worker.process.pid} died`);
      if (worker === masterWorker) {
        console.log(`worker ${worker.process.pid} is the master worker`);
        masterWorker = cluster.fork()
      } else {
        cluster.fork({
          NOTIFYBC_NODE_ROLE: 'slave'
        })
      }
    })
  } else {
    module.exports()
    console.log(`Worker ${process.pid} started`)
  }
}
