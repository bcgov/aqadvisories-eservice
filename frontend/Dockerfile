FROM node:20-alpine

ENV NODE_ENV=production \
    port=3001 \
    file_store_path=/mnt/sessions

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY index.js keycloak.json ./
COPY static ./static

# session-file-store writes here. keycloak.json holds the SSO defaults; each
# environment overrides them with keycloak_* env vars (see openshift.deploy.yml)
RUN mkdir -p /mnt/sessions && chown -R node:node /app /mnt/sessions
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:${port}/ping || exit 1

CMD ["node", "index.js"]
