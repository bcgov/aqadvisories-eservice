---
permalink: /docs/config-nodeRoles/
---

# Node Roles

In a multi-node deployment, some tasks should only be run by one node. That node is designated as _master_. The distinction is made using environment variable _NOTIFYBC_NODE_ROLE_. Setting to anything other than _slave_, including not set, will be regarded as _master_.
