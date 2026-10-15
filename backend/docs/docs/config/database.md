---
permalink: /docs/config-database/
---

# Database

By default _NotifyBC_ uses in-memory database backed up by file in _/server/database/data.json_ for local and docker deployment and MongoDB for OpenShift deployment. To use MongoDB for non-OpenShift deployment, add file _/server/datasources.local.json_ with MongoDB connection information such as following:

```json
{
  "db": {
    "name": "db",
    "connector": "mongodb",
    "host": "127.0.0.1",
    "database": "notifyBC",
    "port": 27017
  }
}
```

See [LoopBack MongoDB data source](https://loopback.io/doc/en/lb3/MongoDB-connector.html#MongoDBconnector-CreatingaMongoDBdatasource) for more configurable properties.
