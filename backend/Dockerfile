FROM node:20
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV
# --openssl-legacy-provider: webpack 3 (client build) uses md4 hashing, removed from
#   OpenSSL 3 by default
# --unhandled-rejections=warn: NotifyBC was written for Node 10, where an unhandled
#   promise rejection only warned. Node 15+ exits instead, so e.g. one failed email
#   delivery (sendEmail throws in an un-awaited promise) would kill the process.
ENV NODE_OPTIONS="--openssl-legacy-provider --unhandled-rejections=warn"
COPY . /usr/src/app
RUN rm -rf node_modules client/node_modules && npm ci

# node:20 ships a "node" user (uid 1000). OpenShift overrides it with a random
# uid in group 0, so NotifyBC writes nothing to the image at runtime; the memory
# connector's data file (server/database) is made group-writable for local runs.
RUN chown -R node:0 server/database && chmod -R g=u server/database
USER node

CMD [ "npm", "start" ]
EXPOSE 3000
