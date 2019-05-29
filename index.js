const express = require('express')
const app = express()
const port = process.env.port || 3000
const role = process.env.notification_sender_role || 'realm:notificaton-sender'

var session = require('express-session')
var Keycloak = require('keycloak-connect')

var memoryStore = new session.MemoryStore()

let keycloak = new Keycloak({ store: memoryStore, idpHint: 'idir' })
app.use(
  session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    store: memoryStore
  })
)
app.use(keycloak.middleware())
app.get('/admin.html', keycloak.protect(role))

app.use(express.static('static'))

app.listen(port, () => console.log(`app listening on port ${port}!`))
