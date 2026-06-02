# Grafana Config

Configuration-only directory. Dashboards, datasources, and alert rules provisioned automatically on startup.

## Structure

```
grafana.ini                             Main Grafana config
provisioning/
  datasources/                          Prometheus, Jaeger, OpenSearch datasources
  dashboards/
    demo.yaml                           Dashboard discovery config
    demo/                               Dashboard JSON files
      apm-dashboard.json
      demo-dashboard.json               Main e-commerce demo dashboard
      exemplars-dashboard.json
      linux-dashboard.json
      NGINX-metrics.json
      opentelemetry-collector.json
      postgresql-dashboard.json
      spanmetrics-dashboard.json
  alerting/                             Alert rules
```

## Editing Dashboards

Edit dashboard JSON files directly. To pick up changes:

```bash
make restart service=grafana   # From repo root
```

Or export a modified dashboard from the Grafana UI (Dashboard → Share → Export JSON) and overwrite the file.

## Gotchas

- Dashboard JSON must use `"uid"` fields that match what datasource references expect — avoid
  letting Grafana auto-generate UIDs when exporting, or datasource links will break.
- `grafana.ini` sets `auth.anonymous` to enabled so the demo runs without login.
