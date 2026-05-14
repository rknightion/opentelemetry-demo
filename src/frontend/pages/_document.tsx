// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import Document, { DocumentContext, Html, Head, Main, NextScript } from 'next/document';
import { ServerStyleSheet } from 'styled-components';
import {context, propagation} from "@opentelemetry/api";

const {
  ENV_PLATFORM,
  WEB_OTEL_SERVICE_NAME,
  PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
  OTEL_COLLECTOR_HOST,
  FARO_URL,
  FARO_APP_NAME,
  FARO_APP_NAMESPACE,
  FARO_APP_VERSION,
  FARO_APP_ENVIRONMENT,
  FARO_SESSION_TRACKING_ENABLED,
  FARO_SESSION_PERSISTENT,
  FARO_SESSION_SAMPLE_RATE,
  FARO_BUNDLE_ID,
} = process.env;

// JSON-encode every value before interpolating into the inline <script> so
// stray quotes / backslashes can never break out of the literal and the same
// path works for missing env vars (becomes `undefined` instead of `'undefined'`).
const enc = (value: string | undefined): string =>
  value === undefined ? 'undefined' : JSON.stringify(value);

export default class MyDocument extends Document<{ envString: string }> {
  static async getInitialProps(ctx: DocumentContext) {
    const sheet = new ServerStyleSheet();
    const originalRenderPage = ctx.renderPage;

    try {
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: App => props => sheet.collectStyles(<App {...props} />),
        });

      const initialProps = await Document.getInitialProps(ctx);
      const baggage = propagation.getBaggage(context.active());
      const isSyntheticRequest = baggage?.getEntry('synthetic_request')?.value === 'true';

      const otlpTracesEndpoint = isSyntheticRequest
          ? `http://${OTEL_COLLECTOR_HOST}:4318/v1/traces`
          : PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;

      const envString = `
        window.ENV = {
          NEXT_PUBLIC_PLATFORM: ${enc(ENV_PLATFORM)},
          NEXT_PUBLIC_OTEL_SERVICE_NAME: ${enc(WEB_OTEL_SERVICE_NAME)},
          NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: ${enc(otlpTracesEndpoint)},
          NEXT_PUBLIC_FARO_URL: ${enc(FARO_URL)},
          NEXT_PUBLIC_FARO_APP_NAME: ${enc(FARO_APP_NAME || WEB_OTEL_SERVICE_NAME)},
          NEXT_PUBLIC_FARO_APP_NAMESPACE: ${enc(FARO_APP_NAMESPACE)},
          NEXT_PUBLIC_FARO_APP_VERSION: ${enc(FARO_APP_VERSION)},
          NEXT_PUBLIC_FARO_APP_ENVIRONMENT: ${enc(FARO_APP_ENVIRONMENT)},
          NEXT_PUBLIC_FARO_SESSION_TRACKING_ENABLED: ${enc(FARO_SESSION_TRACKING_ENABLED)},
          NEXT_PUBLIC_FARO_SESSION_PERSISTENT: ${enc(FARO_SESSION_PERSISTENT)},
          NEXT_PUBLIC_FARO_SESSION_SAMPLE_RATE: ${enc(FARO_SESSION_SAMPLE_RATE)},
          NEXT_PUBLIC_FARO_BUNDLE_ID: ${enc(FARO_BUNDLE_ID)},
          IS_SYNTHETIC_REQUEST: '${isSyntheticRequest}',
        };`;
      return {
        ...initialProps,
        styles: [initialProps.styles, sheet.getStyleElement()],
        envString,
      };
    } finally {
      sheet.seal();
    }
  }

  render() {
    return (
      <Html>
        <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap"
            rel="stylesheet"
          />
        </Head>
        <body>
          <Main />
          <script dangerouslySetInnerHTML={{ __html: this.props.envString }}></script>
          <NextScript />
        </body>
      </Html>
    );
  }
}
