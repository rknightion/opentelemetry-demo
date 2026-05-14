// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

// Faro must be initialized before any other code runs so it can capture errors
// thrown during module evaluation. Keep this import the very first import in
// the entry point.
import FrontendTracer from '../utils/telemetry/FrontendTracer';

import '../styles/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App, { AppContext, AppProps } from 'next/app';
import Router from 'next/router';
import { useEffect } from 'react';
import { FaroErrorBoundary, faro } from '@grafana/faro-react';
import CurrencyProvider from '../providers/Currency.provider';
import CartProvider from '../providers/Cart.provider';
import { ThemeProvider } from 'styled-components';
import Theme from '../styles/Theme';
import SessionGateway from '../gateways/Session.gateway';
import { OpenFeatureProvider, OpenFeature } from '@openfeature/react-sdk';
import { FlagdWebProvider } from '@openfeature/flagd-web-provider';

declare global {
  interface Window {
    ENV: {
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
  }
}

if (typeof window !== 'undefined') {
  FrontendTracer();
  if (window.location) {
    const session = SessionGateway.getSession();

    // Tag every Faro signal with the demo's stable user id so traces, errors
    // and Web Vitals can be grouped per visitor in Grafana Cloud.
    if (faro?.api?.setUser) {
      faro.api.setUser({ id: session.userId });
    }

    // Seed the initial view so the first page load lands in the correct view
    // bucket before any client-side navigation fires.
    if (typeof window !== 'undefined' && faro?.api?.setView) {
      faro.api.setView({ name: window.location.pathname || '/' });
    }

    // Set context prior to provider init to avoid multiple http calls
    OpenFeature.setContext({ targetingKey: session.userId, ...session }).then(() => {
      /**
       * We connect to flagd through the envoy proxy, straight from the browser,
       * for this we need to know the current hostname and port.
       */

      const useTLS = window.location.protocol === 'https:';
      let port = useTLS ? 443 : 80;
      if (window.location.port) {
          port = parseInt(window.location.port, 10);
      }

      OpenFeature.setProvider(
        new FlagdWebProvider({
          host: window.location.hostname,
          pathPrefix: 'flagservice',
          port: port,
          tls: useTLS,
          maxRetries: 3,
          maxDelay: 10000,
        })
      );
    });
  }
}

const queryClient = new QueryClient();

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Pages Router has no native route-change hook for instrumentation, so we
    // bridge Next's router events into Faro's view tracking. Every navigation
    // resets the active view name to the new pathname, which groups subsequent
    // logs/errors/spans under the right page in Frontend Observability.
    const handleRouteChange = (url: string) => {
      if (!faro?.api?.setView) return;
      const pathOnly = url.split('?')[0]?.split('#')[0] || url;
      faro.api.setView({ name: pathOnly });
      faro.api.pushEvent('navigation', { to: pathOnly });
    };
    Router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      Router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, []);

  return (
    <FaroErrorBoundary>
      <ThemeProvider theme={Theme}>
        <OpenFeatureProvider>
          <QueryClientProvider client={queryClient}>
            <CurrencyProvider>
              <CartProvider>
                <Component {...pageProps} />
              </CartProvider>
            </CurrencyProvider>
          </QueryClientProvider>
        </OpenFeatureProvider>
      </ThemeProvider>
    </FaroErrorBoundary>
  );
}

MyApp.getInitialProps = async (appContext: AppContext) => {
  const appProps = await App.getInitialProps(appContext);

  return { ...appProps };
};

export default MyApp;
