---
permalink: /docs/installation/
---

# Installation

_NotifyBC_ can be installed in 3 ways:

1. deploying locally from source code
2. deploying a Docker container
3. deploying to OpenShift

For small-scale production deployment or for evaluation, both source code and docker container will do. For large-scale production deployment that requires horizontal scalability, the recommendation is one of

- deploying to OpenShift
- setting up a load balanced app cluster from source code build, backed by mongodb.

To setup a development environment in order to contribute to _NotifyBC_,
installing from source code is preferred.

## Deploy Locally from Source Code

### System Requirements

- Software
  - Git
  - [Node.js](https://nodejs.org)@>=6.9.1
- Services
  - MongoDB, optional but recommended for production
  - A standard SMTP server to deliver outgoing email, optional but recommended for production. You can use an existing organizational shared service, cloud-based service such as Amazon SES, or setting up your own SMTP server
  - A tcp proxy server such as [nginx stream proxy](http://nginx.org/en/docs/stream/ngx_stream_proxy_module.html) if list-unsubscribe by email is needed and _NotifyBC_ server cannot expose port 25 to internet
  - A SMS service provider account if needs to enable SMS channel. The supported service providers are
    - Twilio (default)
  - SiteMinder, if need to allow authenticated user request
- Network and Permissions
  - Minimum runtime firewall requirements:
    - outbound to your ISP DNS server
    - outbound to any on port 80, 443 and 22 in order to run build scripts and send SMS messages
    - outbound to any on SMTP port 25 if using direct mail; for SMTP relay, outbound to your configured SMTP server and port only
    - inbound to listening port (3000 by default) from other authorized server ips
    - if _NotifyBC_ instance will handle anonymous subscription from client browser, the listening port should be open to internet either directly or indirectly through a reverse proxy; If _NotifyBC_ instance will only handle SiteMinder authenticated webapp requests, the listening port should NOT be open to internet. Instead, it should only open to SiteMinder web agent reverse proxy.
  - If list-unsubscribe by email is needed, then one of the following must be met
    - _NotifyBC_ can bind to port 25 opening to internet
    - a tcp proxy server of which port 25 is open to internet. This proxy server can reach _NotifyBC_ on a tcp port.

### Installation

::: tip ProTips™ install from behind firewall
If you want to install on a server behind firewall which restricts internet connection, you can work around the firewall as long as you have access to a http(s) forward proxy server. Assuming the proxy server is http://my_proxy:8080 which proxies both http and https requests, to use it:

- For Linux

  ```sh
  export http_proxy=http://my_proxy:8080
  export https_proxy=http://my_proxy:8080
  git config --global url."https://".insteadOf git://
  ```

- For Windows

  ```sh
  git config --global http.proxy http://my_proxy:8080
  git config --global url."https://".insteadOf git://
  npm config set proxy http://my_proxy:8080
  npm i -g yarn
  yarn config set proxy http://my_proxy:8080
  ```

  :::

run following commands

```sh
~ $ git clone \
https://github.com/bcgov/NotifyBC.git \
notifyBC
~ $ cd notifyBC
~/notifyBC $ npm i -g yarn && yarn install
~/notifyBC $ npm start
```

If successful, you will see following output

```
> notification@1.0.0 start .../notification
> node .

...
Web server listening at: http://localhost:3000
```

Now browse to <a href="http://localhost:3000" target="_blank">http://localhost:3000</a> the page displays NotifyBC Web Console.

#### Install Windows Service

After get the app running interactively, if your server is Windows and you want to install the app as a Windows service, run

```
npm install -g node-windows
npm link node-windows
node 'windows service.js'
```

This will create and start service _notifyBC_. To change service name, modify file _windows service.js_ before running it. See [node-windows](https://github.com/coreybutler/node-windows) for other operations such as uninstalling the service.

## Deploy Docker Container

If you have git and Docker installed, you can run following command to deploy _NotifyBC_ Docker container:

```sh
~ $ git clone \
https://github.com/bcgov/NotifyBC.git \
notifyBC
~ $ cd notifyBC
~ $ docker build -t notify-bc .
~ $ docker run -p 3000:3000 notify-bc
```

If successful, similar output is displayed as in source code installation.

## Deploy to OpenShift

_NotifyBC_ supports deployment to OpenShift Origin of minimum version 1.5, or other compatible platforms such as OpenShift Container Platform of matching version. [OpenShift instant app templates](https://github.com/bcgov/NotifyBC/blob/main/.opensift-templates) have been created to facilitate build and deployment. This template adopts [source-to-image strategy](https://docs.openshift.org/latest/dev_guide/builds.html#using-secrets-s2i-strategy) with [binary source](https://docs.openshift.org/latest/dev_guide/builds.html#binary-source) input and supports [incremental builds](https://docs.openshift.org/latest/dev_guide/builds.html#incremental-builds).

To deploy to OpenShift, you need to have access to relevant OpenShift projects with minimum edit role. This implies you know and have access to OpenShift web console as identified by _\<openshift-console-url\>_ below.

OpenShift is expected to be setup this way:

- 1 project for build. This project is identified by _\<yourprojectname-tools\>_ below. All build related activities take place in this project.
- 1 or more projects for runtime environments such as _dev_, _test_ etc, identified by _\<yourprojectname-\<env\>>_ below. All deployment activities and runtime artifacts are contained in respective projects to make an environment self-sufficient.

The deployment can be initiated from localhost or automated by CI service such as Jenkins. Regardless, at the initiator's side following software needs to be installed:

- git
- [OpenShift CLI](https://docs.openshift.org/latest/cli_reference/index.html)

If using Jenkins, all the software are pre-installed on OpenShift provided Jenkins instant-app template so it is the preferred CI environment. Instructions below assumes OpenShift Jenkins is used. OpenShift Jenkins should be created in project _\<yourprojectname-tools\>_.

### Hosting Environment Setup

1. Install the templates

   ```bash
   ~ $ git clone \
   https://github.com/bcgov/NotifyBC.git \
   notifyBC
   ~ $ cd notifyBC
   ~ $ oc login -u <username> -p <password> <openshift-console-url>
   ~ $ oc create -f .openshift-templates/notify-bc-build.yml -n <yourprojectname-tools>
   ~ $ oc create -f .openshift-templates/notify-bc.yml -n <yourprojectname-<env>>
   ```

   After this step you will find an instant app template called _notify-bc-build_ available in the _\<yourprojectname-tools\>_ project and _notify-bc_ in the _\<yourprojectname-\<env\>>_ project.

   The template _notify-bc.yml_ creates a single instance MongoDB. If you want a 3-node MongoDB cluster, use template _notify-bc-mongodb-cluster.yml_ instead, i.e. replace last command with

   ```bash
   ~ $ oc create -f .openshift-templates/notify-bc-mongodb-cluster.yml -n <yourprojectname-<env>>
   ```

   MongoDB cluster created by this template uses stateful sets. As of OpenShift 1.5, stateful set is in technology preview phase so use the feature with precaution.

2. create OpenShift apps by clicking _Add to Project_ in web console of respective projects, select JavaScript in languages catalog, and click either _notify-bc-build_ or _notify-bc_ template. Adjust parameters as you see fit.
3. (optional) create instance-specific [configuration](../config-overview/) files by modifying configMap _notify-bc_. To do so, in web console of a runtime environment project, click _Resources > Config Maps > notify-bc > Actions > Edit_. Each config file corresponds to an item in configMap with key being the file name. For example, to create config file _config.local.json_, create an item with key _config.local.json_.

::: tip ProTips™ backup config files
Backup config files to a private secured SCM outside of OpenShift is highly recommended, especially for production environment.
:::

### Build

To build runtime image manually from localhost, run

```sh
~ $ oc start-build notify-bc --follow --wait --from-dir=. -n <yourprojectname-tools>
```

If build is successful, you will find image _\<yourprojectname-tools\>/notify-bc:latest_ is updated.

To initiate the build from Jenkins, create a new Freestyle project. Set _Source Code Management_ to Git repository https://github.com/bcgov/NotifyBC.git and add a _Execute Shell_ build step with the command.

Proper authorization is needed for Jenkins to access OpenShift. The service account used by Jenkins has to be granted edit role in all projects by running

```sh
~ $ oc policy add-role-to-user edit \
system:serviceaccount:<yourprojectname-tools>:<jenkins-service-name> \
-n <yourprojectname-tools>
~ $ oc policy add-role-to-user edit \
system:serviceaccount:<yourprojectname-tools>:<jenkins-service-name> \
-n <yourprojectname-<env>>
```

replace _\<jenkins-service-name\>_ with the jenkins service name. In some editions of OpenShift, _\<jenkins-service-name\>_ is fixed to _default_. To find exact Jenkins service account, add following line to Jenkins shell build step and inspect its build output

```sh
oc whoami
```

### Deploy

Deployment is achieved through image tagging. This guarantees the image deployed to different runtime environments are binary identical. To deploy manually from localhost, run

```sh
~ $ oc tag <yourprojectname-tools>/notify-bc:latest <yourprojectname-<env>>/notify-bc:latest
```

If the deployment is successful, you can launch _NotifyBC_ from the URL provided in _\<yourprojectname-\<env\>>_ project.

To initiate the deployment from Jenkins, add the above command to the build command in Jenkins.

### Change Propagation

To promote runtime image from one environment to another, for example from _dev_ to _test_, run

```
oc tag <yourprojectname-tools>/notify-bc:latest <yourprojectname-test>/notify-bc:latest <yourprojectname-tools>/notify-bc:test
```

The above command will deploy the latest (which should also be dev) runtime image to _test_ env. The purpose of tagging runtime image of _test_ env in both \<yourprojectname-test\>/notify-bc:latest and \<yourprojectname-tools\>/notify-bc:test is to use \<yourprojectname-tools\>/notify-bc:test as backup such that in case the image stream \<yourprojectname-test\>/notify-bc, which is used by _test_ runtime pods, is deleted inadvertently, it can be recovered from \<yourprojectname-tools\>/notify-bc:test.

## Install Docs Website (Optional)

If you want to contribute to _NotifyBC_ docs beyond simple fix ups, run

```sh
yarn --cwd docs install
yarn --cwd docs dev
```

If everything goes well, the last line of the output will be

```sh
> VuePress dev server listening at http://localhost:8080/NotifyBC/
```

You can now browse to the local docs site [http://localhost:8080/NotifyBC](http://localhost:8080/NotifyBC/)
