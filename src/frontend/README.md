# Frontend service

The frontend is a [Next.js](https://nextjs.org/) application that is composed
by two layers.

1. Client side application. Which renders the components for the OTEL webstore.
2. API layer. Connects the client to the backend services by exposing REST endpoints.

## Build Locally

By running `docker compose up` at the root of the project you'll have access to
the frontend client by going to <http://localhost:8080/>.

## Local development

Currently, the easiest way to run the frontend for local development is to execute

```shell
docker compose run --service-ports -e NODE_ENV=development --volume $(pwd)/src/frontend:/app --volume $(pwd)/pb:/app/pb --user node --entrypoint sh frontend
```

from the root folder.

It will start all of the required backend services
and within the container simply run `npm run dev`.
After that the app should be available at <http://localhost:8080/>.

## Grafana Faro Frontend Observability

This fork ships a comprehensive [Grafana Faro Web SDK](https://github.com/grafana/faro-web-sdk)
integration with the demo's existing OpenTelemetry web tracer. Spans are fanned-out
to **both** the demo's OpenTelemetry Collector (preserving backend trace
correlation) **and** the Faro collector (logs, errors, Web Vitals, user actions,
sessions, view tracking).

Everything is driven by environment variables that are surfaced into the
browser via the SSR-injected `window.ENV` snippet in `pages/_document.tsx`, so
a single image can be re-pointed at different Faro stacks **without rebuilding**.

### Runtime environment variables

Set these on the container — all are optional except `FARO_URL`. Leaving
`FARO_URL` empty disables Faro and the demo falls back to OTel-only tracing.

| Variable | Purpose | Default |
|---|---|---|
| `FARO_URL` | Faro collector endpoint (e.g. `https://faro-collector-prod-<region>.grafana.net/collect/<app-key>`). | _(empty — Faro disabled)_ |
| `FARO_APP_NAME` | App name shown in Frontend Observability. | `WEB_OTEL_SERVICE_NAME` |
| `FARO_APP_NAMESPACE` | Logical grouping, sent as `service.namespace`. | _(empty)_ |
| `FARO_APP_VERSION` | Human readable version. | _(empty, falls back to build-time arg)_ |
| `FARO_APP_ENVIRONMENT` | `production`, `staging`, `demolab`, … | `demo` |
| `FARO_SESSION_TRACKING_ENABLED` | `1` or `0` | `1` |
| `FARO_SESSION_PERSISTENT` | `1` for sticky sessions across tab closes. | `1` |
| `FARO_SESSION_SAMPLE_RATE` | `0.0`–`1.0`. Sessions outside the sample are dropped. | `1` |
| `FARO_BUNDLE_ID` | Bundle id used to match runtime signals to uploaded source maps. Baked into the container by CI; only override if you upload source maps out of band. | _(empty)_ |

### What is instrumented

| Signal | Source |
|---|---|
| Uncaught JS errors, unhandled rejections, console errors | `ErrorsInstrumentation` (auto via `getWebInstrumentations`) |
| Web Vitals (LCP, INP, CLS, FCP, TTFB) | `WebVitalsInstrumentation` |
| Page navigation timings & URL changes (no React Router) | `experimental.trackNavigation` |
| Fetch + XHR spans, trace header propagation to backend services | `TracingInstrumentation` |
| Document-load and user-interaction spans | OTel web auto-instrumentations |
| Console log / warn / error capture | `getWebInstrumentations({ captureConsole: true })` |
| Long task / paint / resource timings | `enablePerformanceInstrumentation: true` |
| CSP violation events | `enableContentSecurityPolicyInstrumentation: true` |
| View tracking (per-route grouping) | Next.js Pages Router `routeChangeComplete` -> `faro.api.setView` |
| React component error boundaries | `<FaroErrorBoundary>` wrapping the app tree |
| Session lifecycle (start/pause/resume), persistent or per-tab | `sessionTracking` config |
| User attribution (anonymous demo user id) | `faro.api.setUser` after session bootstrap |
| Bundle id on every signal | injected at build time, surfaced via `app.bundleId` |

### Source map upload

`productionBrowserSourceMaps: true` is enabled in `next.config.js`, so
`next build` emits `.js.map` files into `.next/static/`. Two paths are
available for uploading them to Grafana Cloud Frontend Observability.

#### 1. Automated (GitHub Actions, recommended)

`.github/workflows/publish-frontend.yml` builds and pushes the image to
`ghcr.io/rknightion/opentelemetry-demo:latest-frontend`, then triggers a
follow-up job that uploads source maps when the matching secrets / variables
are configured on the repo:

| Type | Name | Example |
|---|---|---|
| Variable | `FARO_APP_NAME` | `frontend-web` |
| Secret | `FARO_SOURCE_MAP_ENDPOINT` | `https://faro-api-prod-eu-west-2.grafana.net/faro/api/v1` |
| Secret | `FARO_SOURCE_MAP_APP_ID` | `01HMC...` |
| Secret | `FARO_SOURCE_MAP_API_KEY` | `glc_...` (scope: `appplatform.frontendobservability.sourcemaps:write`) |
| Secret | `FARO_SOURCE_MAP_STACK_ID` | `1319552` |

The workflow uses the short commit sha as the bundle id (`FARO_BUNDLE_ID` in
the image), so re-runs against the same commit always upload to the same
bucket. Missing secrets are treated as "skip upload" — the build still
succeeds.

#### 2. Manual upload (from your laptop)

```shell
cd src/frontend

# 1. Set a bundle id. Make this match what the running image will report —
#    if you didn't bake one in, use whatever git short-sha you deployed.
export FARO_BUNDLE_ID="$(git rev-parse --short=12 HEAD)"
export FARO_APP_NAME=frontend-web

# 2. Build with source maps emitted to .next/static.
npm run build

# 3. Inject the bundle id into the built JS so the runtime SDK and source maps
#    agree on a single id. (Skip if your image already had FARO_BUNDLE_ID set
#    at docker build time — the Dockerfile runs this step for you.)
npx faro-cli inject-bundle-id \
  --bundle-id "$FARO_BUNDLE_ID" \
  --app-name "$FARO_APP_NAME" \
  --files ".next/static/**/*.js"

# 4. Upload source maps to Grafana Cloud Frontend Observability.
npx faro-cli upload \
  --endpoint "https://faro-api-prod-<region>.grafana.net/faro/api/v1" \
  --app-id "<APP_ID>" \
  --api-key "$GRAFANA_FARO_API_KEY" \
  --stack-id "<STACK_ID>" \
  --app-name "$FARO_APP_NAME" \
  --bundle-id "$FARO_BUNDLE_ID" \
  --output-path .next/static \
  --recursive \
  --gzip-contents \
  --verbose
```

The values for `<region>`, `<APP_ID>` and `<STACK_ID>` are visible in Grafana
Cloud under **Frontend** → _\<your app\>_ → **Settings → Source maps → Configure
source map uploads**. The API key needs the
`appplatform.frontendobservability.sourcemaps:write` scope (create one in
Grafana Cloud → **Security → Access policies**).

#### 3. Build-time upload via webpack (alternative)

If you prefer the webpack plugin to handle upload inline:

```shell
# Build with --webpack so the @grafana/faro-webpack-plugin runs.
FARO_SOURCE_MAP_ENDPOINT="https://faro-api-prod-<region>.grafana.net/faro/api/v1" \
FARO_SOURCE_MAP_APP_NAME=frontend-web \
FARO_SOURCE_MAP_APP_ID="<APP_ID>" \
FARO_SOURCE_MAP_API_KEY="$GRAFANA_FARO_API_KEY" \
FARO_SOURCE_MAP_STACK_ID="<STACK_ID>" \
FARO_BUNDLE_ID="$(git rev-parse --short=12 HEAD)" \
npx next build --webpack
```

This is automatically picked up by `next.config.js` only when `--webpack` is
used (Turbopack — the Next.js 16 default — has no equivalent plugin yet).
