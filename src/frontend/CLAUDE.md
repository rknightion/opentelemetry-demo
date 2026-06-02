# Frontend Service

Next.js (TypeScript) web app — both the React UI and an API/BFF layer (REST → gRPC to backend services).

## Local Development (without rebuilding the image)

```bash
# From repo root — starts all backend deps and mounts src/frontend into the container:
docker compose run --service-ports -e NODE_ENV=development \
  --volume $(pwd)/src/frontend:/app \
  --volume $(pwd)/pb:/app/pb \
  --user node --entrypoint sh frontend
# Then inside the container:
npm run dev   # Serves on http://localhost:8080/
```

## Build & Type Check

```bash
npm run build   # Production build (emits source maps to .next/static/)
npm run lint    # ESLint
```

## Structure

```
pages/          Next.js pages (UI routes + API routes under pages/api/)
components/     React components
services/       gRPC client wrappers calling backend services
providers/      React context providers (cart, currency, feature flags, Faro)
utils/          Shared helpers
genproto/       Generated TypeScript from demo.proto (do not edit)
```

## Grafana Faro Integration

This fork instruments the frontend with [Grafana Faro Web SDK](https://github.com/grafana/faro-web-sdk).
All config is injected at runtime via `window.ENV` in `pages/_document.tsx` — no rebuild needed to
point at a different Faro endpoint.

Set these on the container (all optional; leaving `FARO_URL` empty disables Faro entirely):

| Variable | Purpose |
|---|---|
| `FARO_URL` | Faro collector endpoint — enables Faro when set |
| `FARO_APP_NAME` | App name in Frontend Observability UI |
| `FARO_APP_NAMESPACE` | `service.namespace` label |
| `FARO_APP_ENVIRONMENT` | `production`, `staging`, `demo`, etc. |
| `FARO_SESSION_SAMPLE_RATE` | `0.0`–`1.0` (default `1`) |

Set `FARO_URL` in `.env.override` (gitignored) to enable locally.

## Protobuf

Generated TypeScript types live in `genproto/`. Regenerate with:

```bash
make docker-generate-protobuf   # From repo root
```

## Tests

Cypress tests live in `cypress/`. Run the full test suite:

```bash
make run-tests   # From repo root — starts all services then runs Cypress + Tracetest
```

## Gotchas

- API routes in `pages/api/` proxy to backend gRPC services — they share proto types with `genproto/`.
- Feature flags use OpenFeature + flagd provider; the flagd host is injected via `FEATURE_FLAG_GRPC_SERVICE_ADDR`.
- Source maps: `productionBrowserSourceMaps: true` in `next.config.js` — `.js.map` files are emitted at build time. Use `faro-cli` to upload them to Grafana Cloud Frontend Observability.
