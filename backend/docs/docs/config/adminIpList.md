---
permalink: /docs/config-adminIpList/
---

# Admin IP List

By [design](../overview/#architecture), _NotifyBC_ classifies incoming requests into four types. For a request to be classified as super-admin, the request's source ip must be in admin ip list. By default, the list contains _localhost_ only as defined by _defaultAdminIps_ in _/server/config.json_

```json
{
  "defaultAdminIps": ["127.0.0.1"]
}
```

to modify, create config object _adminIps_ with updated list in file _/server/config.local.js_ instead. For example, to add ip range _192.168.0.0/24_ to the list

```js
module.exports = {
  adminIps: ['127.0.0.1', '192.168.0.0/24']
};
```

It should be noted that _NotifyBC_ may generate http requests sending to itself. These http requests are expected to be admin requests. If you have created an app cluster such as in OpenShift, you should add the cluster ip range to _adminIps_. In OpenShift, this ip range is a private ip range. In BCGov's OpenShift cluster, the ip range starts with octet 172.

::: danger Define static array config in one file only

Due to a <a href="https://github.com/strongloop/loopback-boot/issues/172">bug</a> in Loopback a config of array type such as <i>adminIps</i> cannot be merged if defined in multiple files with different length. To mitigate, only define an array config in one file.
It is for this reason that the default admin ip list has to use a different name <i>defaultAdminIps</i> as shown above.

:::
