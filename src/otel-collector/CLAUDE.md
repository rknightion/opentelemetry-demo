# OTel Collector Config

Configuration-only directory. No service code — these YAML files are mounted into the `otelcol` container.

## Files

| File | Used by |
|---|---|
| `otelcol-config.yml` | Base config (always loaded) |
| `otelcol-config-full.yml` | Adds Kafka pipeline (`make start` / full stack) |
| `otelcol-config-observability.yml` | Adds exporters to Prometheus, Grafana, etc. |
| `otelcol-config-extras.yml` | Local override stub (empty by default) |
| `otelcol-ebpf-profiling.yml` | Pyroscope eBPF profiling (`make start-profiling`) |

## Editing

Changes to config files take effect on container restart:

```bash
make restart service=otelcol   # From repo root
```

## Gotchas

- `otelcol-config-extras.yml` is the place to add local-only receivers/exporters without touching the shared configs.
- The collector uses `opentelemetry-collector-contrib` image (version in `.env` as `COLLECTOR_CONTRIB_IMAGE`).
