---
permalink: /docs/config-inboundSmtpServer/
---

# Inbound SMTP Server

_NotifyBC_ implemented a custom inbound SMTP server based on Nodemailer [SMTP Server](https://nodemailer.com/extras/smtp-server/) to handle

- [list-unsubscribe by email](../config-listUnsubscribeByEmail/)
- [notification bounce](../config-notificationBounce/)

In order for the emails from internet to reach the SMTP server, a host
where one of the following servers should be listening on port 25
open to internet

1. _NotifyBC_, if it can be installed on such internet-facing host directly; otherwise,
2. a tcp proxy server, such as nginx with stream proxy module that can proxy tcp port 25 traffic to backend _NotifyBC_ instances.

Regardless which above option is chosen, you need to config _NotifyBC_ inbound SMTP server by adding following static config _inboundSmtpServer_ to file _/server/config.local.js_

```js
module.exports = {
  ...
  inboundSmtpServer: {
    enabled: true,
    domain: 'host.foo.com',
    listeningSmtpPort: 25,
    options: {
        ...
    }
  },
}
```

where

- _enabled_ enables/disables the inbound SMTP server with default to _true_.
- _domain_ is the internet-facing host domain. It has no default so **must be set**.
- _listeningSmtpPort_ should be set to 25 if option 1 above is chosen. For options 2, _listeningSmtpPort_ can be set to any opening port. On Unix, _NotifyBC_ has to be run under _root_ account to bind to port 25. If missing, _NotifyBC_ will randomly select an available port upon launch which is usually undesirable so it **should be set**.
- optional _options_ object defines the behavior of [Nodemailer SMTP Server](https://nodemailer.com/extras/smtp-server/#step-3-create-smtpserver-instance).

::: warning Inbound SMTP Server on OpenShift
OpenShift deployment template deploys an inbound SMTP server. Due to the limitation that OpenShift can only expose port 80 and 443 to external, to use the SMTP server, you have to setup a TCP proxy server (i.e. option 2). The inbound SMTP server is exposed as ${INBOUND_SMTP_DOMAIN}:443 , where ${INBOUND_SMTP_DOMAIN} is a template parameter which in absence, a default domain will be created. Configure your TCP proxy server to route traffic to \${INBOUND_SMTP_DOMAIN}:443 over TLS.
:::

## TCP Proxy Server

If _NotifyBC_ is not able to bind to port 25 that opens to internet, perhaps
due to firewall restriction, you can setup a TCP Proxy Server such as Nginx with [ngx_stream_proxy_module](http://nginx.org/en/docs/stream/ngx_stream_proxy_module.html). For example, the following nginx config will proxy SMTP traffic from port 25 to a _NotifyBC_ inbound SMTP server running on OpenShift

```
stream {
    server {
        listen 25;
        proxy_pass ${INBOUND_SMTP_DOMAIN}:443;
        proxy_ssl on;
        proxy_ssl_verify off;
        proxy_ssl_server_name on;
        proxy_connect_timeout 10s;
    }
}
```

Replace _\${INBOUND_SMTP_DOMAIN}_ with the inbound SMTP server route domain.
