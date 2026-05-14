# Copyright The OpenTelemetry Authors
# SPDX-License-Identifier: Apache-2.0

FROM docker.io/library/node:24-slim AS builder

WORKDIR /app

# Build-time Faro metadata. Both are surfaced into the runtime image so the
# Faro SDK sends the same bundle id with every signal it emits, lining up
# stack traces to source maps that have been uploaded out-of-band.
#   FARO_BUNDLE_ID  : stable per-build id, typically the short commit sha
#   FARO_APP_VERSION: human-readable version label
#   FARO_APP_NAME   : matches the Frontend Observability app in Grafana Cloud
ARG FARO_BUNDLE_ID=""
ARG FARO_APP_VERSION=""
ARG FARO_APP_NAME=""

ENV FARO_BUNDLE_ID=${FARO_BUNDLE_ID} \
    FARO_APP_VERSION=${FARO_APP_VERSION} \
    FARO_APP_NAME=${FARO_APP_NAME}

COPY ./src/frontend/package.json package.json
COPY ./src/frontend/package-lock.json package-lock.json

RUN npm ci

COPY ./src/frontend/components/ components/
COPY ./src/frontend/gateways/ gateways/
COPY ./src/frontend/pages/ pages/
COPY ./src/frontend/protos/ protos/
COPY ./src/frontend/providers/ providers/
COPY ./src/frontend/services/ services/
COPY ./src/frontend/styles/ styles/
COPY ./src/frontend/types/ types/

COPY ./src/frontend/utils/enums/ utils/enums/
COPY ./src/frontend/utils/telemetry/ utils/telemetry/
COPY ./src/frontend/utils/imageLoader.js utils/imageLoader.js
COPY ./src/frontend/utils/Request.ts utils/Request.ts

COPY ./src/frontend/next.config.js next.config.js
COPY ./src/frontend/tsconfig.json tsconfig.json

RUN npm run build

# Inject the bundle id into every emitted client JS file so a follow-up
# `faro-cli upload` step (run from CI or by hand) can match those files to
# their source maps. The Faro Web SDK reads this same id at runtime from
# `process.env.FARO_BUNDLE_ID` -> window.ENV.NEXT_PUBLIC_FARO_BUNDLE_ID and
# emits it as `app.bundleId` on every signal.
RUN if [ -n "$FARO_BUNDLE_ID" ] && [ -n "$FARO_APP_NAME" ]; then \
      echo "Injecting Faro bundle id $FARO_BUNDLE_ID into client bundle"; \
      npx faro-cli inject-bundle-id \
        --bundle-id "$FARO_BUNDLE_ID" \
        --app-name "$FARO_APP_NAME" \
        --files ".next/static/**/*.js" || true; \
    fi

# -----------------------------------------------------------------------------

FROM docker.io/library/node:24-slim AS deps

WORKDIR /app

COPY ./src/frontend/package.json package.json
COPY ./src/frontend/package-lock.json package-lock.json

RUN npm ci --omit=dev

# -----------------------------------------------------------------------------

FROM gcr.io/distroless/nodejs24-debian13:nonroot

WORKDIR /app

# Surface the build-time Faro metadata at runtime so the SDK ships the same
# bundle id and version on every signal it sends. _document.tsx picks these
# up from process.env and writes them into window.ENV.
ARG FARO_BUNDLE_ID=""
ARG FARO_APP_VERSION=""
ARG FARO_APP_NAME=""
ENV FARO_BUNDLE_ID=${FARO_BUNDLE_ID} \
    FARO_APP_VERSION=${FARO_APP_VERSION} \
    FARO_APP_NAME=${FARO_APP_NAME}

COPY --from=builder /app/.next/standalone/ ./
COPY --from=builder /app/.next/static/ .next/static/

COPY --from=deps /app/node_modules/ node_modules/

COPY ./src/frontend/public/ public/

COPY ./src/frontend/utils/telemetry/Instrumentation.js Instrumentation.js

EXPOSE ${FRONTEND_PORT}

CMD ["--require=./Instrumentation.js", "server.js"]
