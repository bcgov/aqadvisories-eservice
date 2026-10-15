// loaded by loopback-boot when NODE_ENV=production and merged over datasources.json.
// MONGODB_URI (from the database Secret's database-uri key, see common/openshift.init.yml)
// switches the "db" datasource from the in-memory connector to MongoDB.
const url = process.env.MONGODB_URI

module.exports = url
  ? {
    db: {
      name: 'db',
      connector: 'mongodb',
      url: url,
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  }
  : {}
