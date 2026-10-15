var queue = require('async/queue')
var nodemailer = require('nodemailer')
var successCnt = 0
let transporter = nodemailer.createTransport({
  host: process.argv[2] || 'localhost',
  secure: false,
  port: 25,
  pool: true,
  direct: false,
  maxMessages: process.argv[7] || 99999,
  maxConnections: process.argv[5] || 5
})

let bodyUnit =
  'Lorem ipsum dolor sit amet, facete debitis dolores nam eu, nemore voluptatum interesset at mel. Duo et legimus vituperata, mei adipisci prodesset conclusionemque an. Mnesarchum adversarium eam eu, ad postea labore vituperatoribus eam. Dicam convenire vis ei, id vis quod luptatum. Expetenda consequat at quo, mel inermis volumus intellegam ut, mei vocibus inciderint ea. At error viris has.'
let body = bodyUnit.repeat(process.argv[8] || 1)

let q = queue(function(task, cb) {
  let mailOptions = {
    from: 'noreply@invlid.local',
    to: process.argv[3] || 'test@invlid.local',
    subject: 'Despite unpopularity, Victoria fadsasdfasd',
    text: body
  }
  transporter.sendMail(mailOptions, function(error, info) {
    try {
      if (!error && info.accepted.length < 1) {
        error = new Error('delivery failed')
      } else {
        successCnt++
      }
    } catch (ex) {}
    cb && cb(error)
  })
}, process.argv[6] || 1000)
q.drain = function() {
  console.log('successCnt=' + successCnt)
  process.exit(0)
}

let tasks = []
let i = 0
while (i < (process.argv[4] || 1000)) {
  tasks.push({})
  i++
}
q.push(tasks, function(error) {
  error && console.error(error)
})
