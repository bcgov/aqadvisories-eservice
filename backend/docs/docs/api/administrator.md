---
permalink: /docs/api-administrator/
---

# Administrator

The administrator API provides knowledge factor based authentication mechanism to identify admin request, as opposed to possession factor based admin ip list. Because knowledge factor based authentication is vulnerable to brute-force attack, administrator API is less favorable than admin ip list. Administrator API should only be used in exceptional circumstances such as when obtaining the client's ip or ip range is infeasible.

::: warning Example Use Case
Administrator API was created to circumvent an OpenShift limitation - the source ip of a request initiated from an OpenShift pod cannot be exclusively allocated to the pod's project, rather it has to be shared by all OpenShift projects. Therefore it's difficult to impose granular access control based on source ip.
:::

To enable knowledge factor based authentication, a super-admin manually calls _POST /administrators_ API to create an admin user. Next, the super-admin calls _POST /administrators/login_ API to login the admin user. If both calls are successful, the _POST /administrators/login_ API returns an access token. The super-admin gives the access token to the client, who can make authenticated requests by supplying the access token in either _Authorization_ HTTP header or _access_token_ query parameter.

More details on creating access token can be found [here](http://loopback.io/doc/en/lb3/Introduction-to-User-model-authentication.html). All occurrences of _/Users_ in the referenced doc should be interpreted as _/administrators_, which is _NotifyBC_'s user model name.

::: tip ProTips™ Increase TTL
By default TTL of an access token is set to 14 days by LoopBack. The default time makes sense if users can login themselves. However <i>NotifyBC</i> only allows super-admin to access Administrator API in order to reduce attack window, thus super-admin has to login on behalf of the user to obtain the access token. As a super-admin, you may want to bump up TTL significantly to reduce administrative overhead.
:::

For details and examples on making authenticated requests, see [here](http://loopback.io/doc/en/lb3/Making-authenticated-requests.html).
