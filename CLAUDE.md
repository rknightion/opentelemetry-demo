# CLAUDE.md

@AGENTS.md

## Commands

```bash
make start                        # Full stack (all services + Grafana/Jaeger/Prometheus)
make start-minimal                # Core services only (no Kafka group)
make start-no-o11y                # Full stack without observability tools
make stop                         # Stop and remove all containers + volumes
make build                        # Build all Docker images
make build service=frontend       # Build a single service image
make restart service=frontend     # Restart a running service (no rebuild)
make redeploy service=frontend    # Rebuild + restart a single service
make run-tests                    # Run frontend (Cypress) + trace-based tests
make check                        # Lint: misspell + markdownlint + checklicense + checklinks
make fix                          # Auto-fix misspellings
make docker-generate-protobuf     # Regenerate proto files (Docker-based, run from repo root)
make generate-kubernetes-manifests# Regenerate k8s manifests from compose files
```

Once running, visit:
- Webstore: http://localhost:8080/
- Grafana: http://localhost:8080/grafana/
- Jaeger: http://localhost:8080/jaeger/ui/
- Feature flags: http://localhost:8080/feature/
- Load generator: http://localhost:8080/loadgen/
- Telemetry docs: http://localhost:8080/telemetry/

## Architecture

This is a microservices e-commerce demo showcasing OpenTelemetry across many languages:

| Service | Language | Notes |
|---|---|---|
| accounting | C# (.NET) | Kafka consumer |
| ad | Kotlin (Gradle, JDK 21) | gRPC service |
| cart | C# (.NET) | Stores carts in Valkey (Redis-compatible) |
| checkout | Go | Orchestrates order flow |
| currency | C (CMake) | gRPC service |
| email | Ruby | |
| flagd | Config only | Feature flag JSON at `src/flagd/demo.flagd.json` |
| flagd-ui | Elixir (Phoenix) | Feature flag UI |
| fraud-detection | Kotlin (Gradle, JDK 21) | Kafka consumer |
| frontend | Next.js (TypeScript) | BFF + React UI; Grafana Faro instrumented |
| frontend-proxy | nginx/Envoy | Routes all traffic at :8080 |
| image-provider | nginx | Static product images |
| kafka | Config only | Message bus for accounting + fraud-detection |
| llm | Python | OpenAI-compatible astronomy chatbot |
| load-generator | Python (Locust) | Synthetic traffic at :8080/loadgen/ |
| otel-collector | Config only | `src/otel-collector/otelcol-config*.yml` |
| payment | Node.js (TypeScript) | |
| product-catalog | Go | Serves product JSON |
| product-reviews | Python | |
| quote | PHP | Shipping price quotes |
| react-native-app | React Native | Mobile example app |
| recommendation | Python | gRPC service |
| shipping | Rust | Calls quote service |
| telemetry-docs | Python | Weaver-generated semantic convention docs |

## Compose Layers

The Makefile composes multiple files to form different stack configurations:

- `compose.yaml` — core services (no Kafka)
- `compose.full.yaml` — adds Kafka, accounting, fraud-detection
- `compose.observability.yaml` — Grafana, Jaeger, Prometheus, OpenSearch
- `compose.profiling.yaml` — Pyroscope/Firepit profiling
- `compose.extras.yaml` — local overrides stub (always included last)
- `compose.tests.yaml` — test runners (Cypress, Tracetest)

`make start` uses: full + observability + extras.

## Local Configuration

Copy `.env` values you want to override into `.env.override` (gitignored). Key variables:

```bash
FARO_URL=                   # Enables Grafana Faro in the frontend (empty = disabled)
OPENAI_API_KEY=dummy        # Set to a real key to enable LLM service
ENV_PLATFORM=local          # Change for kubernetes deployments
```

## Protobuf

All services share a single `demo.proto` in `pb/`. After modifying it:

```bash
make docker-generate-protobuf   # Regenerates Go, Python, TypeScript bindings
```

Generated files are committed. CI enforces this with `make check-clean-work-tree`.

## Feature Flags

Feature flags are defined in `src/flagd/demo.flagd.json` and toggled via the UI at
http://localhost:8080/feature/. Available flags: `productCatalogFailure`,
`recommendationCacheFailure`, `adManualGc`, `adHighCpu`, `adFailure`,
`kafkaQueueProblems`, `cartFailure`, `paymentFailure`, `paymentUnreachable`,
`loadGeneratorFloodHomepage`, `imageSlowLoad`, `failedReadinessProbe`,
`emailMemoryLeak`, `intlShippingSlowdown`, `llmInaccurateResponse`, `llmRateLimitError`.

## Grafana Dashboards

Dashboards are provisioned from `src/grafana/provisioning/dashboards/demo/*.json`.
Edit JSON directly; the running Grafana picks them up on restart.

## Gotchas

- **No AI PR comments**: See AGENTS.md — never post AI-generated comments on issues/PRs.
- **Assisted-by trailer**: Use `Assisted-by: Claude Sonnet 4.6` not `Co-authored-by:` (breaks EasyCLA).
- **Proto changes require Docker**: `make generate-protobuf` only works inside Docker; use `make docker-generate-protobuf` locally.
- **`.env.override` is gitignored**: Never commit it. It overrides `.env` values for local dev.
- **`compose.extras.yaml` is always last**: It's the local override layer; never put it before observability files.
