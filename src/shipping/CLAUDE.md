# Shipping Service

Rust gRPC service. Queries the Quote service for price calculations and returns tracking IDs.

## Build & Test

```bash
cargo build             # From this directory
cargo test              # Unit tests (no Docker needed)
docker compose build shipping   # Docker image (from repo root)
```

## Feature Flags

| Flag | Effect |
|---|---|
| `intlShippingSlowdown` | Integer value (default 0). When non-zero, delays non-US shipping requests by that many seconds. US addresses are never affected. |

## Gotchas

- Rust 1.82+ required for local builds; use `rustup` to manage versions.
- The service calls `quote` (PHP) over gRPC — both must be running for end-to-end testing.
- `cargo test` runs unit tests without the full stack; use `make start` for integration testing.
