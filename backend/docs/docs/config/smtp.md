---
permalink: /docs/config-smtp/
---

# SMTP

By default _NotifyBC_ acts as the SMTP server itself and connects directly to recipient's SMTP server. To setup SMTP relay to a host, say _smtp.foo.com_, add following _smtp_ config object to _/server/config.local.js_

```js
module.exports = {
  ...
  smtp: {
    host: 'smtp.foo.com',
    port: 25,
    pool: true,
    tls: {
      rejectUnauthorized: false
    }
  },
}
```

Check out [Nodemailer](https://nodemailer.com/smtp/) for other config options that you can define in _smtp_ object. Using SMTP relay and fine-tuning some options are critical for performance. See [benchmark advices](../benchmarks/#advices). There are also options allowing you to throttle down throughput if needed.
