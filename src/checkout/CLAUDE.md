# Checkout Service

Go gRPC service that orchestrates order placement — calls cart, currency, product-catalog, payment, shipping, and email.

## Build

```bash
go build -o /go/bin/checkout/   # Local binary (from this directory)
docker compose build checkout   # Docker image (from repo root)
```

## Protobuf

Generated bindings live in `genproto/`. After modifying `pb/demo.proto` in the repo root:

```bash
make docker-generate-protobuf   # From repo root — rebuilds Go bindings
```

## Feature Flags

Feature flag typed accessors are generated from `flags.json`:

```bash
go generate ./...   # Regenerates flags/flags_gen.go via OpenFeature CLI
```

Run this after adding or renaming a flag in `flags.json`.

## Test

```bash
go test ./...   # Unit tests (from this directory)
```

## Gotchas

- Checkout calls 6 other services; when testing locally with `make redeploy service=checkout`,
  all dependencies must be running first.
- The `flags/flags_gen.go` file is generated — do not edit it directly.
