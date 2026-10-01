let app
const parallel = require('async/parallel')
const request = require('supertest')
const SMTPConnection = require('smtp-connection')
let smtpSvrImport
let smtpSvr
let origRequest
let origMailParser
let port
beforeAll(done => {
  require('../../server/server.js')(function (err, data) {
    app = data
    let smtpSvrImport = require('../../server/smtp-server')
    smtpSvrImport.app(app, (err, data) => {
      smtpSvr = data
      origRequest = smtpSvrImport.request
      origMailParser = smtpSvrImport.mailParser
      port = smtpSvr.server.address().port
      done()
    })
  })
})

describe('list-unsubscribe by email', function () {
  let connection
  beforeEach(function (done) {
    spyOn(smtpSvr, 'onRcptTo').and.callThrough()
    spyOn(smtpSvr, 'onData').and.callThrough()
    connection = new SMTPConnection({
      port: port,
      secure: true,
      tls: {
        rejectUnauthorized: false
      }
    })

    parallel(
      [
        function (cb) {
          app.models.Subscription.create({
              serviceName: 'myService',
              channel: 'email',
              userChannelId: 'bar@foo.com',
              state: 'confirmed',
              unsubscriptionCode: '12345'
            },
            function (err, res) {
              cb(err, res)
            }
          )
        }
      ],
      function (err, results) {
        expect(err).toBeNull()
        done()
      }
    )
  })

  it('should accept valid email', function (done) {
    spyOn(origRequest, 'get').and.callFake(function () {
      let getReq = request(app).get(
        arguments[0].substring(arguments[0].indexOf('/api'))
      )
      for (let p in arguments[1].headers) {
        if (arguments[1].headers.hasOwnProperty(p)) {
          getReq.set(p, arguments[1].headers[p])
        }
      }
      getReq.end((err, res) => {
        expect(err).toBeNull()
        app.models.Subscription.findById(1, function (err, data) {
          expect(data.state).toBe('deleted')
          done()
        })
      })
    })
    expect(port).toBeGreaterThan(0)
    connection.connect(() => {
      connection.send({
          from: 'bar@foo.com',
          to: 'un-1-12345@invalid.local'
        },
        'unsubscribe',
        (err, info) => {
          expect(err).toBeNull()
          expect(info.accepted.length).toBe(1)
          expect(smtpSvr.onRcptTo).toHaveBeenCalled()
          expect(smtpSvr.onData).toHaveBeenCalled()
          expect(origRequest.get).toHaveBeenCalledWith('http://localhost:3000/api/subscriptions/1/unsubscribe?unsubscriptionCode=12345&userChannelId=bar%40foo.com', {
            headers: {
              /*jshint camelcase: false */
              is_anonymous: true
            }
          })
        }
      )
    })
  })

  it('should reject email of invalid local-part pattern', function (done) {
    connection.connect(() => {
      connection.send({
          from: 'bar@foo.com',
          to: 'undo-1-12345@invalid.local'
        },
        'unsubscribe',
        (err, info) => {
          expect(err.rejected.length).toBe(1)
          expect(smtpSvr.onRcptTo).toHaveBeenCalled()
          expect(smtpSvr.onData).not.toHaveBeenCalled()
          done()
        }
      )
    })
  })

  it('should reject email of invalid domain', function (done) {
    connection.connect(() => {
      connection.send({
          from: 'bar@foo.com',
          to: 'un-1-12345@valid.local'
        },
        'unsubscribe',
        (err, info) => {
          expect(err.rejected.length).toBe(1)
          expect(smtpSvr.onRcptTo).toHaveBeenCalled()
          expect(smtpSvr.onData).not.toHaveBeenCalled()
          done()
        }
      )
    })
  })
})

describe('bounce', function () {
  let connection
  beforeEach(function (done) {
    spyOn(smtpSvr, 'onRcptTo').and.callThrough()
    spyOn(smtpSvr, 'onData').and.callThrough()
    connection = new SMTPConnection({
      port: port,
      secure: true,
      tls: {
        rejectUnauthorized: false
      }
    })
    parallel(
      [
        function (cb) {
          app.models.Subscription.create({
              serviceName: 'myService',
              channel: 'email',
              userChannelId: 'bar@foo.com',
              state: 'confirmed',
              unsubscriptionCode: '12345'
            },
            function (err, res) {
              cb(err, res)
            }
          )
        }
      ],
      function (err, results) {
        expect(err).toBeNull()
        done()
      }
    )
  })

  it('should create bounce record', function (done) {
    spyOn(app.models.Subscription, 'isAdminReq').and.callFake(function () {
      return true
    })
    spyOn(app.models.Bounce, 'isAdminReq').and.callFake(function () {
      return true
    })
    spyOn(origRequest, 'get').and.callFake(function () {
      let args = arguments
      return new Promise((resolve, reject) => {
        let getReq = request(app).get(
          args[0].substring(args[0].indexOf('/api'))
        )
        if (args[1]) {
          for (let p in args[1].headers) {
            if (args[1].headers.hasOwnProperty(p)) {
              getReq.set(p, args[1].headers[p])
            }
          }
        }
        getReq.end((err, data) => {
          if (err) {
            reject(err)
          }
          if (data) {
            data.data = data.body
            resolve(data)
          }
        })
      })
    })
    spyOn(origRequest, 'post').and.callFake(function () {
      let args = arguments
      return new Promise((resolve, reject) => {
        let req = request(app).post(
          args[0].substring(args[0].indexOf('/api'))
        )
        if (args[1]) {
          req.send(args[1])
        }
        req.end((err, data) => {
          if (err) {
            reject(err)
          }
          if (data) {
            data.data = data.body
            expect(data.body.hardBounceCount).toBe(1)
            resolve(data)
          }
        })
      })
    })
    expect(port).toBeGreaterThan(0)
    connection.connect(() => {
      connection.send({
          from: 'postmaster@invalid.local',
          to: 'bn-1-12345@invalid.local'
        },
        `Received: from localhost (localhost)\r\n\tby foo.invalid.local (8.14.4/8.14.4) id w7TItYs4100793;\r\n\tWed, 29 Aug 2018 11:55:34 -0700\r\nDate: Wed, 29 Aug 2018 11:55:34 -0700\r\nFrom: Mail Delivery Subsystem <postmaster@gems.invalid.local>\r\nMessage-Id: <201808291855.w7TItYs4100793@foo.invalid.local>\r\nTo: <bn-5b50cb6e953d170b24983019-42074@invalid.local>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/report; report-type=delivery-status;\r\n\tboundary="w7TItYs4100793.1535568934/foo.invalid.local"\r\nSubject: Returned mail: see transcript for details\r\nAuto-Submitted: auto-generated (failure)\r\n\r\nThis is a MIME-encapsulated message\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local\r\n\r\nThe original message was received at Wed, 29 Aug 2018 11:55:34 -0700\r\nfrom invalid.local [0.0.0.0]\r\n\r\n   ----- The following addresses had permanent fatal errors -----\r\n<bar@foo.com>\r\n    (reason: 550-5.1.1 The email account that you tried to reach does not exist. Please try)\r\n\r\n   ----- Transcript of session follows -----\r\n... while talking to gmail-smtp-in.l.google.com.:\r\n>>> DATA\r\n<<< 550-5.1.1 The email account that you tried to reach does not exist. Please try\r\n<<< 550-5.1.1 double-checking the recipient's email address for typos or\r\n<<< 550-5.1.1 unnecessary spaces. Learn more at\r\n<<< 550 5.1.1  https://support.google.com/mail/?p=NoSuchUser c17-v6si4448431pge.273 - gsmtp\r\n550 5.1.1 <bar@foo.com>... User unknown\r\n<<< 503 5.5.1 RCPT first. c17-v6si4448431pge.273 - gsmtp\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local\r\nContent-Type: message/delivery-status\r\n\r\nReporting-MTA: dns; foo.invalid.local\r\nReceived-From-MTA: DNS; invalid.local\r\nArrival-Date: Wed, 29 Aug 2018 11:55:34 -0700\r\n\r\nFinal-Recipient: RFC822; bar@foo.com\r\nAction: failed\r\nStatus: 5.1.1\r\nRemote-MTA: DNS; gmail-smtp-in.l.google.com\r\nDiagnostic-Code: SMTP; 550-5.1.1 The email account that you tried to reach does not exist. Please try\r\nLast-Attempt-Date: Wed, 29 Aug 2018 11:55:34 -0700\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local\r\nContent-Type: message/rfc822\r\n\r\nReturn-Path: <bn-5b50cb6e953d170b24983019-42074@invalid.local>\r\nReceived: from [127.0.0.1] (invalid.local [0.0.0.0])\r\n\tby foo.invalid.local (8.14.4/8.14.4) with ESMTP id w7TIqOs6099075\r\n\t(version=TLSv1/SSLv3 cipher=DHE-RSA-AES128-GCM-SHA256 bits=128 verify=NO)\r\n\tfor <bar@foo.com>; Wed, 29 Aug 2018 11:55:34 -0700\r\nDKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;\r\n d=mail.www2.invalid.local; q=dns/txt; s=dev;\r\n bh=wrkCugmpWjuk1K/MNn64VeMFmvd+ef1KHXTHHL+GO84=;\r\n h=from:subject:date:message-id:to:mime-version:content-type:list-id:list-unsubscribe;\r\n b=O5i568MBJIL38+umlZxJGAG+vffxe89cbUNbCrjt/QDHRiiLBcLpZBMPTqvQnEJX6gwLXnBkj\r\n m/69oke2/HmSTp9T/I0MmwenuqpEc7lhCeMfCvS19PTaQKb5tb/EK+TQt516yre3ElkCXrr/lyg\r\n PPrZozr8rupPNhK5NZNpABJXQtCQEfdF8Fw7OnHWalvch7Q5jfta84EQ6zOGAC6HfLFe0O/VkVf\r\n sbEwGGyC9OOEyGBpppEMBGx8qXuZxSpxiaWGdGVhW6jf/WLghPwThvDgRYSq9jTNfenMXR2LAPf\r\n FbjSR6GqrRowS4h2GVVyPTYk1SGT0uGJucNa/vlDWgnQ==\r\nContent-Type: multipart/alternative;\r\n boundary="--_NmP-6ea6170c81eda5cc-Part_1"\r\nFrom: donotreply@invalid.local\r\nTo: bar@foo.com\r\nSubject: test\r\nMessage-ID: <1d6819a2-698c-eea7-f3e8-fa4977801d49@invalid.local>\r\nList-ID: <https://invalid.local/test>\r\nList-Unsubscribe: <mailto:un-5b50cb6e953d170b24983019-42074@invalid.local>, <https://invalid.local/notifybc/api/subscriptions/5b50cb6e953d170b24983019/unsubscribe?unsubscriptionCode=42074>\r\nDate: Wed, 29 Aug 2018 18:55:34 +0000\r\nMIME-Version: 1.0\r\nX-Scanned-By: MIMEDefang 2.70 on 0.0.0.0\r\n\r\n----_NmP-6ea6170c81eda5cc-Part_1\r\nContent-Type: text/plain\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nThis is a test https://invalid.local/notifybc/api/subscriptions/5b50c=\r\nb6e953d170b24983019/unsubscribe?unsubscriptionCode=3D42074\r\n----_NmP-6ea6170c81eda5cc-Part_1\r\nContent-Type: text/html\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nThis is a test.\r\n----_NmP-6ea6170c81eda5cc-Part_1--\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local--\r\n\r\n`,
        (err, info) => {
          expect(err).toBeNull()
          expect(info.accepted.length).toBe(1)
          expect(smtpSvr.onRcptTo).toHaveBeenCalled()
          expect(smtpSvr.onData).toHaveBeenCalled()
          done()
        }
      )
    })
  })

  it('should increment bounce record', async function (done) {
    spyOn(app.models.Subscription, 'isAdminReq').and.callFake(function () {
      return true
    })
    spyOn(app.models.Bounce, 'isAdminReq').and.callFake(function () {
      return true
    })
    spyOn(origRequest, 'get').and.callFake(function () {
      let args = arguments
      return new Promise((resolve, reject) => {
        let getReq = request(app).get(
          args[0].substring(args[0].indexOf('/api'))
        )
        if (args[1]) {
          for (let p in args[1].headers) {
            if (args[1].headers.hasOwnProperty(p)) {
              getReq.set(p, args[1].headers[p])
            }
          }
        }
        getReq.end((err, data) => {
          if (err) {
            reject(err)
          }
          if (data) {
            data.data = data.body
            resolve(data)
          }
        })
      })
    })
    spyOn(origRequest, 'patch').and.callFake(function () {
      let args = arguments
      return new Promise((resolve, reject) => {
        let req = request(app).patch(
          args[0].substring(args[0].indexOf('/api'))
        )
        if (args[1]) {
          req.send(args[1])
        }
        req.end((err, data) => {
          if (err) {
            reject(err)
          }
          if (data) {
            data.data = data.body
            expect(data.body.hardBounceCount).toBe(2)
            resolve(data)
          }
        })
      })
    })
    expect(port).toBeGreaterThan(0)
    let data = await app.models.Bounce.create({
      "channel": "email",
      "userChannelId": "bar@foo.com",
      "hardBounceCount": 1,
      "state": "active"
    })
    connection.connect(() => {
      connection.send({
          from: 'postmaster@invalid.local',
          to: 'bn-1-12345@invalid.local'
        },
        `Received: from localhost (localhost)\r\n\tby foo.invalid.local (8.14.4/8.14.4) id w7TItYs4100793;\r\n\tWed, 29 Aug 2018 11:55:34 -0700\r\nDate: Wed, 29 Aug 2018 11:55:34 -0700\r\nFrom: Mail Delivery Subsystem <postmaster@gems.invalid.local>\r\nMessage-Id: <201808291855.w7TItYs4100793@foo.invalid.local>\r\nTo: <bn-5b50cb6e953d170b24983019-42074@invalid.local>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/report; report-type=delivery-status;\r\n\tboundary="w7TItYs4100793.1535568934/foo.invalid.local"\r\nSubject: Returned mail: see transcript for details\r\nAuto-Submitted: auto-generated (failure)\r\n\r\nThis is a MIME-encapsulated message\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local\r\nContent-Type: message/delivery-status\r\n\r\nReporting-MTA: dns; foo.invalid.local\r\nReceived-From-MTA: DNS; invalid.local\r\nArrival-Date: Wed, 29 Aug 2018 11:55:34 -0700\r\n\r\nFinal-Recipient: RFC822; bar@foo.com\r\nAction: failed\r\nStatus: 5.1.1\r\nRemote-MTA: DNS; gmail-smtp-in.l.google.com\r\nDiagnostic-Code: SMTP; 550-5.1.1 The email account that you tried to reach does not exist. Please try\r\nLast-Attempt-Date: Wed, 29 Aug 2018 11:55:34 -0700\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local--\r\n\r\n`,
        (err, info) => {
          expect(err).toBeNull()
          expect(info.accepted.length).toBe(1)
          expect(smtpSvr.onRcptTo).toHaveBeenCalled()
          expect(smtpSvr.onData).toHaveBeenCalled()
          done()
        }
      )
    })
  })

  it('should not increment bounce record if subject doesn\'t match', async function (done) {
    spyOn(app.models.Subscription, 'isAdminReq').and.callFake(function () {
      return true
    })
    spyOn(app.models.Bounce, 'isAdminReq').and.callFake(function () {
      return true
    })
    spyOn(origRequest, 'get').and.callFake(function () {
      let args = arguments
      return new Promise((resolve, reject) => {
        let getReq = request(app).get(
          args[0].substring(args[0].indexOf('/api'))
        )
        if (args[1]) {
          for (let p in args[1].headers) {
            if (args[1].headers.hasOwnProperty(p)) {
              getReq.set(p, args[1].headers[p])
            }
          }
        }
        getReq.end((err, data) => {
          if (err) {
            reject(err)
          }
          if (data) {
            data.data = data.body
            resolve(data)
          }
        })
      })
    })
    spyOn(origRequest, 'patch').and.callFake(function () {
      let args = arguments
      return new Promise((resolve, reject) => {
        let req = request(app).patch(
          args[0].substring(args[0].indexOf('/api'))
        )
        if (args[1]) {
          req.send(args[1])
        }
        req.end((err, data) => {
          if (err) {
            reject(err)
          }
          if (data) {
            data.data = data.body
            expect(data.body.hardBounceCount).toBe(1)
            resolve(data)
          }
        })
      })
    })
    expect(port).toBeGreaterThan(0)
    let data = await app.models.Bounce.create({
      "channel": "email",
      "userChannelId": "bar@foo.com",
      "hardBounceCount": 1,
      "state": "active"
    })
    connection.connect(() => {
      connection.send({
          from: 'postmaster@invalid.local',
          to: 'bn-1-12345@invalid.local'
        },
        `From: Mail Delivery Subsystem <postmaster@gems.invalid.local>\r\nMessage-Id: <201808291855.w7TItYs4100793@foo.invalid.local>\r\nTo: <bn-5b50cb6e953d170b24983019-42074@invalid.local>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/report; report-type=delivery-status;\r\n\tboundary="w7TItYs4100793.1535568934/foo.invalid.local"\r\nSubject: invalid\r\n\r\nThis is a MIME-encapsulated message\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local\r\nContent-Type: message/delivery-status\r\n\r\nReporting-MTA: dns; foo.invalid.local\r\nReceived-From-MTA: DNS; invalid.local\r\nArrival-Date: Wed, 29 Aug 2018 11:55:34 -0700\r\n\r\nFinal-Recipient: RFC822; bar@foo.com\r\nAction: failed\r\nStatus: 5.1.1\r\nRemote-MTA: DNS; gmail-smtp-in.l.google.com\r\nDiagnostic-Code: SMTP; 550-5.1.1 The email account that you tried to reach does not exist. Please try\r\nLast-Attempt-Date: Wed, 29 Aug 2018 11:55:34 -0700\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local--\r\n\r\n`,
        (err, info) => {
          expect(err).toBeNull()
          expect(info.accepted.length).toBe(1)
          expect(smtpSvr.onRcptTo).toHaveBeenCalled()
          expect(smtpSvr.onData).toHaveBeenCalled()
          done()
        }
      )
    })
  })

  it('should not increment bounce record if status code doesn\'t match', async function (done) {
    spyOn(app.models.Subscription, 'isAdminReq').and.callFake(function () {
      return true
    })
    spyOn(app.models.Bounce, 'isAdminReq').and.callFake(function () {
      return true
    })
    spyOn(origRequest, 'get').and.callFake(function () {
      let args = arguments
      return new Promise((resolve, reject) => {
        let getReq = request(app).get(
          args[0].substring(args[0].indexOf('/api'))
        )
        if (args[1]) {
          for (let p in args[1].headers) {
            if (args[1].headers.hasOwnProperty(p)) {
              getReq.set(p, args[1].headers[p])
            }
          }
        }
        getReq.end((err, data) => {
          if (err) {
            reject(err)
          }
          if (data) {
            data.data = data.body
            resolve(data)
          }
        })
      })
    })
    spyOn(origRequest, 'patch').and.callFake(function () {
      let args = arguments
      return new Promise((resolve, reject) => {
        let req = request(app).patch(
          args[0].substring(args[0].indexOf('/api'))
        )
        if (args[1]) {
          req.send(args[1])
        }
        req.end((err, data) => {
          if (err) {
            reject(err)
          }
          if (data) {
            data.data = data.body
            expect(data.body.hardBounceCount).toBe(1)
            resolve(data)
          }
        })
      })
    })
    expect(port).toBeGreaterThan(0)
    let data = await app.models.Bounce.create({
      "channel": "email",
      "userChannelId": "bar@foo.com",
      "hardBounceCount": 1,
      "state": "active"
    })
    connection.connect(() => {
      connection.send({
          from: 'postmaster@invalid.local',
          to: 'bn-1-12345@invalid.local'
        },
        `From: Mail Delivery Subsystem <postmaster@gems.invalid.local>\r\nTo: <bn-5b50cb6e953d170b24983019-42074@invalid.local>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/report; report-type=delivery-status;\r\n\tboundary="w7TItYs4100793.1535568934/foo.invalid.local"\r\nSubject: Returned mail: see transcript for details\r\nAuto-Submitted: auto-generated (failure)\r\n\r\nThis is a MIME-encapsulated message\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local\r\nContent-Type: message/delivery-status\r\n\r\nReporting-MTA: dns; foo.invalid.local\r\nReceived-From-MTA: DNS; invalid.local\r\nArrival-Date: Wed, 29 Aug 2018 11:55:34 -0700\r\n\r\nFinal-Recipient: RFC822; bar@foo.com\r\nAction: failed\r\nStatus: 4.1.1\r\n\r\n`,
        (err, info) => {
          expect(err).toBeNull()
          expect(info.accepted.length).toBe(1)
          expect(smtpSvr.onRcptTo).toHaveBeenCalled()
          expect(smtpSvr.onData).toHaveBeenCalled()
          done()
        }
      )
    })
  })

  it('should not increment bounce record if email doesn\'t match', async function (done) {
    spyOn(app.models.Subscription, 'isAdminReq').and.callFake(function () {
      return true
    })
    spyOn(app.models.Bounce, 'isAdminReq').and.callFake(function () {
      return true
    })
    spyOn(origRequest, 'get').and.callFake(function () {
      let args = arguments
      return new Promise((resolve, reject) => {
        let getReq = request(app).get(
          args[0].substring(args[0].indexOf('/api'))
        )
        if (args[1]) {
          for (let p in args[1].headers) {
            if (args[1].headers.hasOwnProperty(p)) {
              getReq.set(p, args[1].headers[p])
            }
          }
        }
        getReq.end((err, data) => {
          if (err) {
            reject(err)
          }
          if (data) {
            data.data = data.body
            resolve(data)
          }
        })
      })
    })
    spyOn(origRequest, 'patch').and.callFake(function () {
      let args = arguments
      return new Promise((resolve, reject) => {
        let req = request(app).patch(
          args[0].substring(args[0].indexOf('/api'))
        )
        if (args[1]) {
          req.send(args[1])
        }
        req.end((err, data) => {
          if (err) {
            reject(err)
          }
          if (data) {
            data.data = data.body
            expect(data.body.hardBounceCount).toBe(1)
            resolve(data)
          }
        })
      })
    })
    expect(port).toBeGreaterThan(0)
    let data = await app.models.Bounce.create({
      "channel": "email",
      "userChannelId": "bar@foo.com",
      "hardBounceCount": 1,
      "state": "active"
    })
    connection.connect(() => {
      connection.send({
          from: 'postmaster@invalid.local',
          to: 'bn-1-12345@invalid.local'
        },
        `From: Mail Delivery Subsystem <postmaster@gems.invalid.local>\r\nTo: <bn-5b50cb6e953d170b24983019-42074@invalid.local>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/report; report-type=delivery-status;\r\n\tboundary="w7TItYs4100793.1535568934/foo.invalid.local"\r\nSubject: Returned mail: see transcript for details\r\nAuto-Submitted: auto-generated (failure)\r\n\r\nThis is a MIME-encapsulated message\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local\r\nContent-Type: message/delivery-status\r\n\r\nReporting-MTA: dns; foo.invalid.local\r\nReceived-From-MTA: DNS; invalid.local\r\nArrival-Date: Wed, 29 Aug 2018 11:55:34 -0700\r\n\r\nFinal-Recipient: RFC822; bar@invalid.local\r\nAction: failed\r\nStatus: 5.1.1\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local\r\n\r\n`,
        (err, info) => {
          expect(err).toBeNull()
          expect(info.accepted.length).toBe(1)
          expect(smtpSvr.onRcptTo).toHaveBeenCalled()
          expect(smtpSvr.onData).toHaveBeenCalled()
          done()
        }
      )
    })
  })

  it('should check header x-failed-recipients', async function (done) {
    spyOn(app.models.Subscription, 'isAdminReq').and.callFake(function () {
      return true
    })
    spyOn(app.models.Bounce, 'isAdminReq').and.callFake(function () {
      return true
    })
    spyOn(origRequest, 'get').and.callFake(function () {
      let args = arguments
      return new Promise((resolve, reject) => {
        let getReq = request(app).get(
          args[0].substring(args[0].indexOf('/api'))
        )
        if (args[1]) {
          for (let p in args[1].headers) {
            if (args[1].headers.hasOwnProperty(p)) {
              getReq.set(p, args[1].headers[p])
            }
          }
        }
        getReq.end((err, data) => {
          if (err) {
            reject(err)
          }
          if (data) {
            data.data = data.body
            resolve(data)
          }
        })
      })
    })
    spyOn(origRequest, 'patch').and.callFake(function () {
      let args = arguments
      return new Promise((resolve, reject) => {
        let req = request(app).patch(
          args[0].substring(args[0].indexOf('/api'))
        )
        if (args[1]) {
          req.send(args[1])
        }
        req.end((err, data) => {
          if (err) {
            reject(err)
          }
          if (data) {
            data.data = data.body
            expect(data.body.hardBounceCount).toBe(2)
            resolve(data)
          }
        })
      })
    })
    expect(port).toBeGreaterThan(0)
    let data = await app.models.Bounce.create({
      "channel": "email",
      "userChannelId": "bar@foo.com",
      "hardBounceCount": 1,
      "state": "active"
    })
    connection.connect(() => {
      connection.send({
          from: 'postmaster@invalid.local',
          to: 'bn-1-12345@invalid.local'
        },
        `From: Mail Delivery Subsystem <postmaster@gems.invalid.local>\r\nTo: <bn-5b50cb6e953d170b24983019-42074@invalid.local>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/report; report-type=delivery-status;\r\n\tboundary="w7TItYs4100793.1535568934/foo.invalid.local"\r\nSubject: Returned mail: see transcript for details\r\nX-Failed-Recipients: bar@foo.com\r\nAuto-Submitted: auto-generated (failure)\r\n\r\nThis is a MIME-encapsulated message\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local\r\nContent-Type: message/delivery-status\r\n\r\nReporting-MTA: dns; foo.invalid.local\r\nReceived-From-MTA: DNS; invalid.local\r\nArrival-Date: Wed, 29 Aug 2018 11:55:34 -0700\r\n\r\nFinal-Recipient: RFC822; bar@invalid.local\r\nAction: failed\r\nStatus: 5.1.1\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local\r\n\r\n`,
        (err, info) => {
          expect(err).toBeNull()
          expect(info.accepted.length).toBe(1)
          expect(smtpSvr.onRcptTo).toHaveBeenCalled()
          expect(smtpSvr.onData).toHaveBeenCalled()
          done()
        }
      )
    })
  })

  it('should unsubscribe and delete bounce record when hardBounceCount exceeds threshold',
    async function (done) {
      spyOn(app.models.Subscription, 'isAdminReq').and.callFake(function () {
        return true
      })
      spyOn(app.models.Bounce, 'isAdminReq').and.callFake(function () {
        return true
      })
      spyOn(origRequest, 'get').and.callFake(function () {
        let args = arguments
        return new Promise((resolve, reject) => {
          let getReq = request(app).get(
            args[0].substring(args[0].indexOf('/api'))
          )
          if (args[1]) {
            for (let p in args[1].headers) {
              if (args[1].headers.hasOwnProperty(p)) {
                getReq.set(p, args[1].headers[p])
              }
            }
          }
          getReq.end(async (err, data) => {
            if (err) {
              reject(err)
            }
            if (data) {
              data.data = data.body
              if (args[0].indexOf('/unsubscribe?unsubscriptionCode') >= 0) {
                let data = await app.models.Subscription.findById(1)
                expect(data.state).toBe('deleted')
              }
              resolve(data)
            }
          })
        })
      })
      spyOn(origRequest, 'patch').and.callFake(function () {
        let args = arguments
        return new Promise((resolve, reject) => {
          let req = request(app).patch(
            args[0].substring(args[0].indexOf('/api'))
          )
          if (args[1]) {
            req.send(args[1])
          }
          req.end(async (err, data) => {
            if (err) {
              reject(err)
            }
            if (data) {
              data.data = data.body
              if (args[1].state) {
                let data = await app.models.Bounce.findById(1)
                expect(data.state).toBe('deleted')
              }
              resolve(data)
            }
          })
        })
      })
      expect(port).toBeGreaterThan(0)
      let data = await app.models.Bounce.create({
        "channel": "email",
        "userChannelId": "bar@foo.com",
        "hardBounceCount": 2,
        "state": "active"
      })
      connection.connect(() => {
        connection.send({
            from: 'postmaster@invalid.local',
            to: 'bn-1-12345@invalid.local'
          },
          `Received: from localhost (localhost)\r\n\tby foo.invalid.local (8.14.4/8.14.4) id w7TItYs4100793;\r\n\tWed, 29 Aug 2018 11:55:34 -0700\r\nDate: Wed, 29 Aug 2018 11:55:34 -0700\r\nFrom: Mail Delivery Subsystem <postmaster@gems.invalid.local>\r\nMessage-Id: <201808291855.w7TItYs4100793@foo.invalid.local>\r\nTo: <bn-5b50cb6e953d170b24983019-42074@invalid.local>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/report; report-type=delivery-status;\r\n\tboundary="w7TItYs4100793.1535568934/foo.invalid.local"\r\nSubject: Returned mail: see transcript for details\r\nAuto-Submitted: auto-generated (failure)\r\n\r\nThis is a MIME-encapsulated message\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local\r\n\r\nThe original message was received at Wed, 29 Aug 2018 11:55:34 -0700\r\nfrom invalid.local [0.0.0.0]\r\n\r\n   ----- The following addresses had permanent fatal errors -----\r\n<bar@foo.com>\r\n    (reason: 550-5.1.1 The email account that you tried to reach does not exist. Please try)\r\n\r\n   ----- Transcript of session follows -----\r\n... while talking to gmail-smtp-in.l.google.com.:\r\n>>> DATA\r\n<<< 550-5.1.1 The email account that you tried to reach does not exist. Please try\r\n<<< 550-5.1.1 double-checking the recipient's email address for typos or\r\n<<< 550-5.1.1 unnecessary spaces. Learn more at\r\n<<< 550 5.1.1  https://support.google.com/mail/?p=NoSuchUser c17-v6si4448431pge.273 - gsmtp\r\n550 5.1.1 <bar@foo.com>... User unknown\r\n<<< 503 5.5.1 RCPT first. c17-v6si4448431pge.273 - gsmtp\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local\r\nContent-Type: message/delivery-status\r\n\r\nReporting-MTA: dns; foo.invalid.local\r\nReceived-From-MTA: DNS; invalid.local\r\nArrival-Date: Wed, 29 Aug 2018 11:55:34 -0700\r\n\r\nFinal-Recipient: RFC822; bar@foo.com\r\nAction: failed\r\nStatus: 5.1.1\r\nRemote-MTA: DNS; gmail-smtp-in.l.google.com\r\nDiagnostic-Code: SMTP; 550-5.1.1 The email account that you tried to reach does not exist. Please try\r\nLast-Attempt-Date: Wed, 29 Aug 2018 11:55:34 -0700\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local\r\nContent-Type: message/rfc822\r\n\r\nReturn-Path: <bn-5b50cb6e953d170b24983019-42074@invalid.local>\r\nReceived: from [127.0.0.1] (invalid.local [0.0.0.0])\r\n\tby foo.invalid.local (8.14.4/8.14.4) with ESMTP id w7TIqOs6099075\r\n\t(version=TLSv1/SSLv3 cipher=DHE-RSA-AES128-GCM-SHA256 bits=128 verify=NO)\r\n\tfor <bar@foo.com>; Wed, 29 Aug 2018 11:55:34 -0700\r\nDKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;\r\n d=mail.www2.invalid.local; q=dns/txt; s=dev;\r\n bh=wrkCugmpWjuk1K/MNn64VeMFmvd+ef1KHXTHHL+GO84=;\r\n h=from:subject:date:message-id:to:mime-version:content-type:list-id:list-unsubscribe;\r\n b=O5i568MBJIL38+umlZxJGAG+vffxe89cbUNbCrjt/QDHRiiLBcLpZBMPTqvQnEJX6gwLXnBkj\r\n m/69oke2/HmSTp9T/I0MmwenuqpEc7lhCeMfCvS19PTaQKb5tb/EK+TQt516yre3ElkCXrr/lyg\r\n PPrZozr8rupPNhK5NZNpABJXQtCQEfdF8Fw7OnHWalvch7Q5jfta84EQ6zOGAC6HfLFe0O/VkVf\r\n sbEwGGyC9OOEyGBpppEMBGx8qXuZxSpxiaWGdGVhW6jf/WLghPwThvDgRYSq9jTNfenMXR2LAPf\r\n FbjSR6GqrRowS4h2GVVyPTYk1SGT0uGJucNa/vlDWgnQ==\r\nContent-Type: multipart/alternative;\r\n boundary="--_NmP-6ea6170c81eda5cc-Part_1"\r\nFrom: donotreply@invalid.local\r\nTo: bar@foo.com\r\nSubject: test\r\nMessage-ID: <1d6819a2-698c-eea7-f3e8-fa4977801d49@invalid.local>\r\nList-ID: <https://invalid.local/test>\r\nList-Unsubscribe: <mailto:un-5b50cb6e953d170b24983019-42074@invalid.local>, <https://invalid.local/notifybc/api/subscriptions/5b50cb6e953d170b24983019/unsubscribe?unsubscriptionCode=42074>\r\nDate: Wed, 29 Aug 2018 18:55:34 +0000\r\nMIME-Version: 1.0\r\nX-Scanned-By: MIMEDefang 2.70 on 0.0.0.0\r\n\r\n----_NmP-6ea6170c81eda5cc-Part_1\r\nContent-Type: text/plain\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nThis is a test https://invalid.local/notifybc/api/subscriptions/5b50c=\r\nb6e953d170b24983019/unsubscribe?unsubscriptionCode=3D42074\r\n----_NmP-6ea6170c81eda5cc-Part_1\r\nContent-Type: text/html\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nThis is a test.\r\n----_NmP-6ea6170c81eda5cc-Part_1--\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local--\r\n\r\n`,
          (err, info) => {
            expect(err).toBeNull()
            expect(info.accepted.length).toBe(1)
            expect(smtpSvr.onRcptTo).toHaveBeenCalled()
            expect(smtpSvr.onData).toHaveBeenCalled()
            done()
          }
        )
      })
    })

  it('should handle parse error', async function (done) {
    spyOn(origMailParser, 'simpleParser').and.callFake(function () {
      return new Promise((resolve, reject) => {
        process.nextTick(reject, "error!")
      })
    })
    connection.connect(() => {
      connection.send({
          from: 'postmaster@invalid.local',
          to: 'bn-1-12345@invalid.local'
        },
        `Content-Type: multipart/report; report-type=delivery-status;\r\n\tboundary="w7TItYs4100793.1535568934/foo.invalid.local"\r\nSubject: Returned mail: see transcript for details\r\nAuto-Submitted: auto-generated (failure)\r\n\r\nThis is a MIME-encapsulated message\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local\r\nContent-Type: message/delivery-status\r\n\r\nReporting-MTA: dns; foo.invalid.local\r\nReceived-From-MTA: DNS; invalid.local\r\nArrival-Date: Wed, 29 Aug 2018 11:55:34 -0700\r\n\r\nFinal-Recipient: RFC822; bar@invalid.local\r\nAction: failed\r\nStatus: 5.1.1\r\n\r\n--w7TItYs4100793.1535568934/foo.invalid.local\r\n\r\n`,
        (err, info) => {
          expect(err.responseCode).toBe(451)
          expect(smtpSvr.onRcptTo).toHaveBeenCalled()
          expect(smtpSvr.onData).toHaveBeenCalled()
          done()
        }
      )
    })
  })
})
