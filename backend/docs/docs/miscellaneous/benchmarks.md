---
permalink: /docs/benchmarks/
---

# Benchmarks

::: warning tl;dr
A <i>NotifyBC</i> server node can deliver 1 million emails in as little as 1 hour to a SMTP server node. SMTP server node's disk I/O is the bottleneck in such case. Throughput can be improved through horizontal scaling.
:::

When _NotifyBC_ is used to deliver broadcast push notifications to a large number of subscribers, probably the most important benchmark is throughput. The benchmark is especially critical if a latency cap is desired. To facilitate capacity planning, load testing on the email channel has been conducted. The test environment, procedure, results and performance tuning advices are provided hereafter.

## Environment

### Hardware

Two computers, connected by 1Gbps LAN, are used to host

- _NotifyBC_
  - Mac Mini Late 2012 model
  - Intel core i7-3615QM
  - 16GB RAM
  - 2TB HDD
- SMTP and mail delivery
  - Lenovo ThinkCentre M Series 2015 model
  - Intel core i5-3470
  - 8GB RAM
  - 256GB SSD

### Software Stack

The test was performed in August 2017. Unless otherwise specified, the versions of all other software were reasonably up-to-date at the time of testing.

- _NotifyBC_

  - MacOS Sierra Version 10.12.6
  - Virtualbox VM with 8vCPU, 10GB RAM, created using miniShift v1.3.1+f4900b07
  - OpenShift 1.5.1+7b451fc with metrics
  - default _NotifyBC_ OpenShift installation, which contains following relevant pods
    - 1 mongodb pod with 1 core, 1GiB RAM limit
    - a variable number of Nodejs app pods each with 1 core, 1GiB RAM limit. The number varies by test runs as indicated in result.

- SMTP and mail delivery
  - Windows 7 host
  - Virtualbox VM with 4 vCPU, 3.5GB RAM, running Windows Server 2012
  - added SMTP Server feature
  - in SMTP Server properties dialog box, uncheck all of following boxes in _Messages_ tab
    - Limit message size to (KB)
    - Limit session size to (KB)
    - Limit number of messages per connection to
    - Limit number of recipients per message to

## Procedure

1. update or create file _/server/config.local.js_ through [configMap](../installation/#update-configuration-files). Add sections for SMTP server and a custom filter function

   ```
   var _ = require('lodash')
   module.exports = {
     ...
     smtp: {
       host: '<smtp-vm-ip-or-hostname>',
       secure: false,
       port: 25,
       pool: true,
       direct: false,
       maxMessages: Infinity,
       maxConnections: 50
     },
     ...
     notification: {
       broadcastCustomFilterFunctions: {
         /*jshint camelcase: false */
         contains_ci: {
           _func: function(resolvedArgs) {
             if (!resolvedArgs[0] || !resolvedArgs[1]) {
               return false
             }
             return (
               _.toLower(resolvedArgs[0]).indexOf(
                _.toLower(resolvedArgs[1])) >= 0
             )
           },
           _signature: [
             {
               types: [2]
             },
             {
               types: [2]
             }
           ]
         }
       }
     }
   }
   ```

2. create a number of subscriptions in bulk using script [bulk-post-subs.js](https://github.com/bcgov/NotifyBC/blob/main/utils/load-testing/bulk-post-subs.js). To load test different email volumes, you can create bulk subscriptions in different services. For example, generate 10 subscriptions under service named _load10_; 1,000,000 subscriptions under service _load1000000_ etc. _bulk-post-subs.js_ takes _userChannelId_ and other optional parameters

   ```
   $ node utils/load-testing/bulk-post-subs.js -h
   Usage: node bulk-post-subs.js [Options] <userChannelId>
   [Options]:
   -a, --api-url-prefix=<string>                      api url prefix. default to http://localhost:3000/api
   -c, --channel=<string>                             channel. default to email
   -s, --service-name=<string>                        service name. default to load
   -n, --number-of-subscribers=<int>                  number of subscribers. positive integer. default to 1000
   -f, --broadcast-push-notification-filter=<string>  broadcast push notification filter. default to "contains_ci(title,'vancouver') || contains_ci(title,'victoria')"
   -h, --help                                         display this help
   ```

   The generated subscriptions contain a filter, hence all load testing results below included time spent on filtering.

3. launch load testing using script [curl-ntf.sh](https://github.com/bcgov/NotifyBC/blob/main/utils/load-testing/curl-ntf.sh), which takes following optional parameters

   ```
   utils/load-testing/curl-ntf.sh <apiUrlPrefix> <serviceName> <senderEmail>
   ```

   The script will print start time and the time taken to dispatch the notification.

## Results

| email count | time taken (min) | throughput (#/min) | app pod count | notes on bottleneck                         |
| ----------: | ---------------: | -----------------: | ------------: | ------------------------------------------- |
|   1,000,000 |             71.5 |             13,986 |             1 | app pod cpu capped                          |
|     100,000 |              5.8 |             17,241 |             2 | smtp vm disk queue length hits 1 frequently |
|   1,000,000 |               57 |             17,544 |             2 | smtp vm disk queue length hits 1 frequently |
|   1,000,000 |             57.8 |             17,301 |             3 | smtp vm disk queue length hits 1 frequently |

Test runs using other software or configurations described below have also been conducted. Because throughput is significantly lower, results are not shown

- using Linux sendmail SMTP. The throughput of a 4-vCPU Linux VM is about the same as a 1-vCPU Windows SMTP server. Bottleneck in such case is the CPU of SMTP server.
- Reducing _NotifyBC_ app pod's resource limit to 100 millicore CPU and 512MiB RAM. Even when scaled up pod count to 15, throughput is still about 1/3 of a 1-core pod.

[Here](../../attachments/benchmark-email.txt) is a sample email saved onto the mail drop folder of SMTP server.

### Comparison to Other Benchmarks

According to [Baseline Performance for SMTP](<https://technet.microsoft.com/en-us/library/bb124213(v=exchg.65).aspx>) published on Microsoft Technet in 2005, Windows SMTP server has a max throughput of 142 emails/s. However this _NotifyBC_ load test yields a max throughput of 292 emails/s. The discrepancy may be attributed to following factors

1. Email size in Microsoft's load test is 50k, as opposed to 1k used in this test
2. SSD storage is used in this test. It is unlikely the test conducted in 2005 used SSD.

## Advices

- Avoid using default direct mode in production. Instead use SMTP server. Direct mode doesn't support connection pooling, resulting in port depletion quickly.
- Enable SMTP [pooling](https://nodemailer.com/smtp/pooled/).
- Set smtp config _maxConnections_ to a number big enough as long as SMTP server can handle. Test found for Windows SMTP server 50 is a suitable number, beyond which performance gain is insignificant.
- Set smtp config _maxMessages_ to maximum possible number allowed by your SMTP server, or _Infinity_ if SMTP server imposes no such constraint
- Avoid setting CPU resource limit too low for _NotifyBC_ app pods.
- If you have control over the SMTP server,
  - use SSD for its storage
  - create a load balanced cluster if possible, since SMTP server is more likely to be the bottleneck.
