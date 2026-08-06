// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

/*
 * Grafana Faro Web SDK — frontend observability (RUM).
 *
 * Deliberately initialised WITHOUT `TracingInstrumentation`. FrontendTracer.ts
 * calls `provider.register()`, which installs the *global* OpenTelemetry tracer
 * provider and propagator. Faro's TracingInstrumentation does the same thing,
 * and OpenTelemetry ignores a second global registration — so whichever runs
 * first wins and the other is silently inert. `_app.tsx` calls FrontendTracer()
 * on load, so adding Faro tracing here produced exactly zero browser spans and
 * no traceparent. Instead: the OTel tracer stays the sole span source (it
 * already exports to the collector and propagates traceparent to the backend),
 * and Faro owns errors, Web Vitals, sessions, console logs and network timing.
 *
 * Entirely opt-in. With FARO_URL unset this module does nothing, so upstream
 * `docker compose up` behaviour is unchanged.
 */

import { getWebInstrumentations, initializeFaro, isInternalFaroOnGlobalObject } from '@grafana/faro-web-sdk';

const parseBool = (value: string | undefined, fallback: boolean) => {
  if (value == null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(value);
};

const parseRate = (value: string | undefined, fallback: number) => {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const FaroInit = () => {
  if (typeof window === 'undefined' || isInternalFaroOnGlobalObject()) {
    return;
  }

  const {
    NEXT_PUBLIC_OTEL_SERVICE_NAME = '',
    NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = '',
    NEXT_PUBLIC_FARO_URL = '',
    NEXT_PUBLIC_FARO_APP_NAME = '',
    NEXT_PUBLIC_FARO_APP_NAMESPACE = '',
    NEXT_PUBLIC_FARO_APP_VERSION = '',
    NEXT_PUBLIC_FARO_APP_ENVIRONMENT = '',
    NEXT_PUBLIC_FARO_SESSION_TRACKING_ENABLED,
    NEXT_PUBLIC_FARO_SESSION_PERSISTENT,
    NEXT_PUBLIC_FARO_SESSION_SAMPLE_RATE,
  } = window.ENV ?? {};

  if (!NEXT_PUBLIC_FARO_URL) {
    return;
  }

  // Faro's fetch/XHR instrumentation would otherwise record the OTel exporter's
  // own trace exports and Faro's own ingest POSTs as application network calls —
  // self-referential noise on every batch flush.
  const ignoreUrls: (string | RegExp)[] = [NEXT_PUBLIC_FARO_URL];
  if (NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
    ignoreUrls.push(NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT);
  }

  try {
    initializeFaro({
      url: NEXT_PUBLIC_FARO_URL,
      app: {
        name: NEXT_PUBLIC_FARO_APP_NAME || NEXT_PUBLIC_OTEL_SERVICE_NAME || 'frontend',
        version: NEXT_PUBLIC_FARO_APP_VERSION || undefined,
        environment: NEXT_PUBLIC_FARO_APP_ENVIRONMENT || undefined,
        namespace: NEXT_PUBLIC_FARO_APP_NAMESPACE || undefined,
      },
      instrumentations: [...getWebInstrumentations()],
      sessionTracking: {
        enabled: parseBool(NEXT_PUBLIC_FARO_SESSION_TRACKING_ENABLED, true),
        persistent: parseBool(NEXT_PUBLIC_FARO_SESSION_PERSISTENT, true),
        samplingRate: parseRate(NEXT_PUBLIC_FARO_SESSION_SAMPLE_RATE, 1),
      },
      ignoreUrls,
      ignoreErrors: [
        // Layout quirks — harmless, not real errors
        /^ResizeObserver loop limit exceeded$/,
        /^ResizeObserver loop completed with undelivered notifications$/,
        // Cross-origin scripts with no useful stack
        /^Script error\.$/,
        // Browser extension interference
        /chrome-extension:\/\//,
        /moz-extension:\/\//,
      ],
      // No Faro router integration exists for the Next.js Pages Router, so track
      // navigations generically. Captures fromUrl/toUrl and navigation duration
      // (actual URLs, not route patterns).
      experimental: { trackNavigation: true },
    });
  } catch {
    // Faro must never break the app.
  }
};

export default FaroInit;
