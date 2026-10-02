---
permalink: /docs/api-overview/
---

# API Overview

_NotifyBC_'s core function is implemented by two [LoopBack models](https://loopback.io/doc/en/lb3/LoopBack+core+concepts#LoopBackcoreconcepts-Models) - subscription and notification. Other models - configuration, administrator and bounces, are for administrative purposes. A LoopBack model determines the underlying database schema and the API.
The APIs displayed in the web console (by default <a href="http://localhost:3000" target="_blank">http://localhost:3000</a>) and API explorer are also grouped by the LoopBack models. Click on a LoopBack model in API explorer, say notification, to explore the operations on that model. Model specific APIs are available here:

- [Subscription](../api-subscription)
- [Notification](../api-notification)
- [Configuration](../api-config)
- [Administrator](../api-administrator)
- [Bounce](../api-bounce)
