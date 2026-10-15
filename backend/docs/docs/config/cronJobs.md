---
permalink: /docs/config-cronJobs/
---

# Cron Jobs

_NotifyBC_ runs several cron jobs described below. These jobs are controlled by sub-properties defined in config object _cron_. To change config, create the object and properties in file _/server/config.local.js_.

By default cron jobs are enabled. In a multi-node deployment, cron jobs should only run on the [master node](../config-nodeRoles/) to ensure single execution.

## Purge Data

This cron job purges old notifications, subscriptions and notification bounces. The default frequency of cron job and retention policy are defined by _cron.purgeData_ config object in file _/server/config.json_

```json
{
  "cron": {
    "purgeData": {
      "timeSpec": "0 0 1 * * *",
      "pushNotificationRetentionDays": 30,
      "expiredInAppNotificationRetentionDays": 30,
      "nonConfirmedSubscriptionRetentionDays": 30,
      "deletedBounceRetentionDays": 30,
      "defaultRetentionDays": 30
    }
  }
}
```

The config items are

- <a name="timeSpec"></a>_timeSpec_: a space separated fields conformed to [unix crontab format](<https://www.freebsd.org/cgi/man.cgi?crontab(5)>) with an optional left-most seconds field. See [allowed ranges](https://github.com/kelektiv/node-cron#cron-ranges) of each field.
- _pushNotificationRetentionDays_: the retention days of push notifications
- _expiredInAppNotificationRetentionDays_: the retention days of expired inApp notifications
- _nonConfirmedSubscriptionRetentionDays_: the retention days of non-confirmed subscriptions, i.e. all unconfirmed and deleted subscriptions
- _deletedBounceRetentionDays_: the retention days of deleted notification bounces
- _defaultRetentionDays_: if any of the above retention day config item is omitted, default retention days is used as fall back.

To change a config item, set the config item in file _/server/config.local.js_. For example, to run cron jobs at 2am daily, add following object to _/server/config.local.js_

```js
module.exports = {
  cron: {
    purgeData: {
      timeSpec: '0 0 2 * * *'
    }
  }
};
```

## Dispatch Live Notifications

This cron job sends out future-dated notifications when the notification becomes current. The default config is defined by _cron.dispatchLiveNotifications_ config object in file _/server/config.json_

```json
{
  "cron": {
    "dispatchLiveNotifications": {
      "timeSpec": "0 * * * * *"
    }
  }
}
```

_timeSpec_ follows [same syntax described above](#timeSpec).

## Check Rss Config Updates

This cron job monitors RSS feed notification dynamic config items. If a config item is created, updated or deleted, the cron job starts, restarts, or stops the RSS-specific cron job. The default config is defined by _cron.checkRssConfigUpdates_ config object in file _/server/config.json_

```json
{
  "cron": {
    "checkRssConfigUpdates": {
      "timeSpec": "0 * * * * *"
    }
  }
}
```

_timeSpec_ follows [same syntax described above](#timeSpec). Note this _timeSpec_ doesn't control the RSS poll frequency (which is defined in dynamic configs and is service specific), instead it only controls the frequency to check for dynamic config changes.

## Delete Notification Bounces

This cron job deletes notification bounces if the latest notification is deemed delivered successfully. The criteria of successful delivery are

1. No bounce received since the latest notification started dispatching, and
2. a configured time span has lapsed since the latest notification finished dispatching

The default config is defined by _cron.deleteBounces_ config object in file _/server/config.json_

```json
{
  "cron": {
    "deleteBounces": {
      "timeSpec": "0 0 * * * *",
      "minLapsedHoursSinceLatestNotificationEnded": 1
    }
  }
}
```

where

- _timeSpec_ is the frequency of cron job, following [same syntax described above](#timeSpec)
- _minLapsedHoursSinceLatestNotificationEnded_ is the time span
