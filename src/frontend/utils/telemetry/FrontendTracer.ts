// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import {
  ReactIntegration,
  WebVitalsInstrumentation,
  ViewInstrumentation,
  faro,
  getWebInstrumentations,
  initializeFaro,
  isInternalFaroOnGlobalObject,
} from '@grafana/faro-react';
import {
  FaroMetaAttributesSpanProcessor,
  FaroTraceExporter,
  TracingInstrumentation,
} from '@grafana/faro-web-tracing';
import type { Context } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import type { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

import { SessionIdProcessor } from './SessionIdProcessor';

type FaroEnv = {
  NEXT_PUBLIC_PLATFORM?: string;
  NEXT_PUBLIC_OTEL_SERVICE_NAME?: string;
  NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
  NEXT_PUBLIC_FARO_URL?: string;
  NEXT_PUBLIC_FARO_APP_NAME?: string;
  NEXT_PUBLIC_FARO_APP_NAMESPACE?: string;
  NEXT_PUBLIC_FARO_APP_VERSION?: string;
  NEXT_PUBLIC_FARO_APP_ENVIRONMENT?: string;
  NEXT_PUBLIC_FARO_SESSION_TRACKING_ENABLED?: string;
  NEXT_PUBLIC_FARO_SESSION_PERSISTENT?: string;
  NEXT_PUBLIC_FARO_SESSION_SAMPLE_RATE?: string;
  NEXT_PUBLIC_FARO_BUNDLE_ID?: string;
  IS_SYNTHETIC_REQUEST?: string;
};

const parseBool = (value: string | undefined, fallback: boolean) => {
  if (value == null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(value);
};

const parseFloatSafe = (value: string | undefined, fallback: number) => {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// A minimal SpanProcessor that fan-outs to multiple downstream processors. The
// browser OpenTelemetry SDK has no built-in MultiSpanProcessor and Faro's
// TracingInstrumentation only accepts a single `spanProcessor`, so we provide
// one here. Used to send spans to both Faro's collector and the demo's
// OpenTelemetry Collector simultaneously.
class CompositeSpanProcessor implements SpanProcessor {
  constructor(private readonly processors: SpanProcessor[]) {}

  onStart(span: Span, parentContext: Context): void {
    for (const processor of this.processors) {
      processor.onStart(span, parentContext);
    }
  }

  onEnd(span: ReadableSpan): void {
    for (const processor of this.processors) {
      processor.onEnd(span);
    }
  }

  forceFlush(): Promise<void> {
    return Promise.all(this.processors.map(p => p.forceFlush())).then(() => undefined);
  }

  shutdown(): Promise<void> {
    return Promise.all(this.processors.map(p => p.shutdown())).then(() => undefined);
  }
}

const FrontendTracer = async () => {
  if (typeof window === 'undefined') {
    return;
  }

  // Hot reload / second SPA navigation safety - never initialize twice.
  if (isInternalFaroOnGlobalObject()) {
    return;
  }

  const env: FaroEnv = (window.ENV as FaroEnv) ?? {};

  const {
    NEXT_PUBLIC_OTEL_SERVICE_NAME = '',
    NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = '',
    NEXT_PUBLIC_FARO_URL = '',
    NEXT_PUBLIC_FARO_APP_NAME = '',
    NEXT_PUBLIC_FARO_APP_NAMESPACE = '',
    NEXT_PUBLIC_FARO_APP_VERSION = '',
    NEXT_PUBLIC_FARO_APP_ENVIRONMENT = '',
    NEXT_PUBLIC_FARO_SESSION_TRACKING_ENABLED = 'true',
    NEXT_PUBLIC_FARO_SESSION_PERSISTENT = 'true',
    NEXT_PUBLIC_FARO_SESSION_SAMPLE_RATE = '1',
    NEXT_PUBLIC_FARO_BUNDLE_ID = '',
    IS_SYNTHETIC_REQUEST = '',
  } = env;

  if (!NEXT_PUBLIC_FARO_URL) {
    // Faro collector not configured. Bail out — server-side OTel tracing keeps
    // working via the demo's existing Instrumentation.js, but the browser will
    // skip frontend instrumentation. This lets the demo run locally without
    // Grafana Cloud credentials.
    return;
  }

  const appName =
    NEXT_PUBLIC_FARO_APP_NAME || NEXT_PUBLIC_OTEL_SERVICE_NAME || 'frontend-web';
  const appVersion = NEXT_PUBLIC_FARO_APP_VERSION || 'dev';
  const appEnvironment = NEXT_PUBLIC_FARO_APP_ENVIRONMENT || 'demo';

  // Lazy-import the zone context manager only in the browser to keep `zone.js`
  // out of the Next.js server bundle.
  const { ZoneContextManager } = await import('@opentelemetry/context-zone');

  initializeFaro({
    url: NEXT_PUBLIC_FARO_URL,
    app: {
      name: appName,
      version: appVersion,
      environment: appEnvironment,
      ...(NEXT_PUBLIC_FARO_APP_NAMESPACE ? { namespace: NEXT_PUBLIC_FARO_APP_NAMESPACE } : {}),
      ...(NEXT_PUBLIC_FARO_BUNDLE_ID ? { bundleId: NEXT_PUBLIC_FARO_BUNDLE_ID } : {}),
    },
    sessionTracking: {
      enabled: parseBool(NEXT_PUBLIC_FARO_SESSION_TRACKING_ENABLED, true),
      persistent: parseBool(NEXT_PUBLIC_FARO_SESSION_PERSISTENT, true),
      samplingRate: parseFloatSafe(NEXT_PUBLIC_FARO_SESSION_SAMPLE_RATE, 1),
    },
    // Leave the Faro instance reachable on `window.faro` for ad-hoc debugging.
    preventGlobalExposure: false,
    // Suppress noise that is never actionable.
    ignoreErrors: [
      /^ResizeObserver loop limit exceeded$/,
      /^ResizeObserver loop completed with undelivered notifications/,
      /^Script error\.?$/,
      /chrome-extension:\/\//,
      /moz-extension:\/\//,
      /safari-extension:\/\//,
      /safari-web-extension:\/\//,
      /Cancel rendering route/,
      /Hydration failed because the initial UI does not match what was rendered on the server/,
    ],
    // Track URL change + DOM update timings even without a Faro-aware router.
    experimental: {
      trackNavigation: true,
    },
    instrumentations: [
      ...getWebInstrumentations({
        captureConsole: true,
        enablePerformanceInstrumentation: true,
        enableContentSecurityPolicyInstrumentation: true,
      }),
      // Web Vitals (LCP, INP, CLS, FCP, TTFB) — graphed by Frontend Observability.
      new WebVitalsInstrumentation(),
      // View transition events (paired with `faro.api.setView` calls on route change).
      new ViewInstrumentation(),
      // OpenTelemetry web tracing — fetch, XHR, document load, user interaction.
      // The custom span processor below fans-out to both the Faro collector and
      // the demo's OpenTelemetry Collector.
      new TracingInstrumentation({
        resourceAttributes: {
          'demo.synthetic_request': IS_SYNTHETIC_REQUEST,
        },
        contextManager: new ZoneContextManager(),
        spanProcessor: buildSpanProcessor({
          otlpTracesEndpoint: NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
        }),
        instrumentationOptions: {
          // Propagate W3C trace context to ALL outbound requests so the OTel
          // collector can stitch browser spans to backend service spans.
          propagateTraceHeaderCorsUrls: [/.*/],
          fetchInstrumentationOptions: {
            applyCustomAttributesOnSpan: span => {
              span.setAttribute('demo.synthetic_request', IS_SYNTHETIC_REQUEST);
            },
          },
          xhrInstrumentationOptions: {
            applyCustomAttributesOnSpan: span => {
              span.setAttribute('demo.synthetic_request', IS_SYNTHETIC_REQUEST);
            },
          },
        },
      }),
      // React error boundary and profiler integration. Router config is omitted
      // because the demo uses Next.js Pages Router; route-change view tracking
      // is wired separately in `pages/_app.tsx` via Next.js router events.
      new ReactIntegration(),
    ],
  });
};

const buildSpanProcessor = ({
  otlpTracesEndpoint,
}: {
  otlpTracesEndpoint: string;
}): SpanProcessor => {
  // 1. Session id attribute is added to every span (matches demo's existing behavior).
  // 2. Spans get batched to the Faro collector via FaroTraceExporter.
  // 3. Spans are also batched to the OTel collector so backend correlation
  //    (with cart, checkout, etc.) keeps working.
  const sessionIdProcessor = new SessionIdProcessor();

  const faroBatchProcessor = new BatchSpanProcessor(
    new FaroTraceExporter({ api: faro.api }),
    {
      scheduledDelayMillis: TracingInstrumentation.SCHEDULED_BATCH_DELAY_MS,
      maxExportBatchSize: 30,
    }
  );

  const processors: SpanProcessor[] = [sessionIdProcessor, faroBatchProcessor];

  if (otlpTracesEndpoint) {
    processors.push(
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: otlpTracesEndpoint }),
        { scheduledDelayMillis: 500 }
      )
    );
  }

  return new FaroMetaAttributesSpanProcessor(
    new CompositeSpanProcessor(processors),
    faro.metas
  );
};

export default FrontendTracer;
