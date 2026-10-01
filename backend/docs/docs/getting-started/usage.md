---
permalink: /docs/usage/
---

# Basic Usage

After [installing](../installation) _NotifyBC_, you can start exploring _NotifyBC_ resources by opening web console [http://localhost:3000](http://localhost:3000). You can further explore APIs by clicking the API explorer in web console and expand the data models. The API calls you made with API explorer as well as API calls made by web console are by default treated as [admin requests](../overview/#architecture). To see the result for user requests, you can choose one of the following methods

- [define admin ip list](../config-adminIpList/) and avoid putting localhost (127.0.0.1) in the list
- access the API explorer from another ip

Furthermore, to get results of an authenticated user, do one of the following

- access the API via a SiteMinder proxy if you have configured SiteMinder properly
- use a tool such as _curl_ that allows to specify custom headers, and supply SiteMinder header _SM_USER_:

```sh
 $ curl -X GET --header "Accept: application/json" \
    --header "SM_USER: foo" \
    "http://localhost:3000/api/notifications"
```

Consult the [API docs](../api-overview/) for valid inputs and expected outcome while you are exploring the APIs. Once you are familiar with the APIs, you can start writing code to call the APIs from either user browser or from a server application.
