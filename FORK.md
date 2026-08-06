# This fork — what it changes and what it deliberately doesn't

`rknightion/opentelemetry-demo`, deployed into the `robknight` EKS cluster by
`m7kni/rkps-awsinfra` (`applications/otel-demo/`). Upstream is
`open-telemetry/opentelemetry-demo`; `sync-upstream.yml` opens a daily sync PR.

## The fork carries exactly one functional patch

**Grafana Faro Web SDK on the frontend** — `src/frontend/utils/telemetry/FaroInit.ts`,
wired in `pages/_app.tsx`, configured at runtime through `window.ENV` from
`pages/_document.tsx`. Empty `FARO_URL` disables it, so plain `docker compose up`
behaves like upstream.

**Faro is initialised WITHOUT `TracingInstrumentation`, and that is deliberate.**
`FrontendTracer.ts` calls `provider.register()`, which installs the *global*
OpenTelemetry tracer provider and propagator. Faro's `TracingInstrumentation`
does the same thing, and OpenTelemetry ignores a second global registration —
whichever runs first wins and the other is silently inert. `_app.tsx` calls
`FrontendTracer()` on load, so adding Faro tracing produces **zero browser spans
and no traceparent** while looking correctly configured. The pre-2026-08 fork
shipped that bug for months behind a `CompositeSpanProcessor`. Do not re-add it.
The OTel tracer is the sole span source; Faro takes errors, Web Vitals, sessions,
console logs and network timing.

## Everything else runs upstream's images

`values.yaml` in the infra repo defaults to `ghcr.io/open-telemetry/demo` and sets
an `imageOverride` for `frontend` only. `publish-frontend.yml` builds that one
image and nothing else — **there is no build-everything matrix, on purpose.**

Three patches were dropped at the v3.0.0 reset because upstream now does the same
thing. Do not reintroduce them:

| dropped patch | why |
| --- | --- |
| `imageLoader.js` relative URLs | upstream v3 emits relative URLs for the same hydration reason |
| `product-catalog` sqlcommenter | upstream v3 ships `otelsql.WithSQLCommenter(true)` |
| `ad` `grpc-bom` alignment | the flagd `0.13.1` / grpc `1.79.0`-vs-`1.81.0` mismatch no longer exists |

If you patch another service you must also add an `imageOverride` for it in the
infra repo's `values.yaml` **and** extend `publish-frontend.yml`, or the cluster
will keep running upstream's build and the patch will appear to do nothing.

## History

The pre-v3 fork state — Faro-with-tracing, frontend SSR workarounds, the three
dropped patches, and a ~20-component build matrix — is preserved at the
**`pre-v3-fork`** tag. `main` was reset to upstream on 2026-08-06 rather than
merged, because 290 upstream commits against a restructured frontend (with
`product-reviews` deleted) was mostly conflict resolution against dead code.

Rationale and decisions: **m7kni/rkps-awsinfra#273**.
