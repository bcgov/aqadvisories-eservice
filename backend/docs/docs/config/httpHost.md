---
permalink: /docs/config-httpHost/
---

# HTTP Host

_httpHost_ config sets the fallback http host used by

- mail merge token substitution
- internal HTTP requests spawned by _NotifyBC_

_httpHost_ can be overridden by other configs or data. For example

- _internalHttpHost_ config
- _httpHost_ field in a notification

There are contexts where there is no alternatives to _httpHost_. Therefore this config should be defined.

Define the config, which has no default value, in _/server/config.local.js_

```js
module.exports = {
  httpHost: 'http://foo.com'
};
```
