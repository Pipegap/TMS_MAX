FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build


FROM node:22-slim AS runtime

ENV NODE_ENV=production
ENV NODE_OPTIONS=--use-system-ca

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY russian-trusted-root-ca.cer /tmp/russian-trusted-root-ca.cer
COPY russian-trusted-sub-ca.cer /tmp/russian-trusted-sub-ca.cer

RUN openssl x509 -inform DER \
      -in /tmp/russian-trusted-root-ca.cer \
      -out /usr/local/share/ca-certificates/russian-trusted-root-ca.crt \
    && openssl x509 -inform DER \
      -in /tmp/russian-trusted-sub-ca.cer \
      -out /usr/local/share/ca-certificates/russian-trusted-sub-ca.crt \
    && update-ca-certificates \
    && rm /tmp/russian-trusted-root-ca.cer /tmp/russian-trusted-sub-ca.cer

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY migrations ./migrations
COPY data ./data

USER node

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:8000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]