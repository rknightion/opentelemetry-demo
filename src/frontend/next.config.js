// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

/** @type {import('next').NextConfig} */

const dotEnv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const { resolve } = require('path');

const myEnv = dotEnv.config({
  path: resolve(__dirname, '../../.env'),
});
dotenvExpand.expand(myEnv);

const {
  AD_ADDR = '',
  CART_ADDR = '',
  CHECKOUT_ADDR = '',
  CURRENCY_ADDR = '',
  PRODUCT_CATALOG_ADDR = '',
  PRODUCT_REVIEWS_ADDR = '',
  RECOMMENDATION_ADDR = '',
  SHIPPING_ADDR = '',
  ENV_PLATFORM = '',
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = '',
  OTEL_SERVICE_NAME = 'frontend',
  PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = '',
} = process.env;

// Faro source map upload (build-time only). When FARO_SOURCE_MAP_ENDPOINT and
// friends are set, attach the Faro webpack plugin so production builds:
//   1. inject a bundle id into the client bundle
//   2. upload .map files to Grafana Cloud Frontend Observability
// Skipped in dev / when env vars are missing.
const FaroSourceMapUploaderPlugin = (() => {
  try {
    return require('@grafana/faro-webpack-plugin');
  } catch (_error) {
    return null;
  }
})();

const {
  FARO_SOURCE_MAP_ENDPOINT = '',
  FARO_SOURCE_MAP_APP_NAME = '',
  FARO_SOURCE_MAP_APP_ID = '',
  FARO_SOURCE_MAP_API_KEY = '',
  FARO_SOURCE_MAP_STACK_ID = '',
  FARO_BUNDLE_ID = '',
  FARO_SOURCE_MAP_VERBOSE = '',
  FARO_SOURCE_MAP_GZIP = 'true',
  FARO_SOURCE_MAP_KEEP_AFTER_UPLOAD = '',
  FARO_SOURCE_MAP_SKIP_UPLOAD = '',
} = process.env;

const faroSourceMapEnabled =
  Boolean(FaroSourceMapUploaderPlugin) &&
  Boolean(FARO_SOURCE_MAP_ENDPOINT && FARO_SOURCE_MAP_APP_NAME && FARO_SOURCE_MAP_APP_ID && FARO_SOURCE_MAP_API_KEY && FARO_SOURCE_MAP_STACK_ID);

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Emit browser source maps so Faro can map minified production stack traces
  // back to the original source. Adds a small build-size cost; uncomment the
  // env-gated `false` below if that matters for a particular environment.
  productionBrowserSourceMaps: true,
  compiler: {
    styledComponents: true,
  },
  // Turbopack configuration (Next.js 16 default bundler)
  // Turbopack automatically handles Node.js polyfills for client bundles
  turbopack: {
    // Set root to current directory to avoid confusion with parent lockfile
    root: __dirname,
  },
  // Keep webpack config for backwards compatibility if --webpack flag is used.
  // The Faro source map uploader plugin only runs under webpack — for Turbopack
  // builds use `faro-cli upload` after `next build` (see README).
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback.http2 = false;
      config.resolve.fallback.tls = false;
      config.resolve.fallback.net = false;
      config.resolve.fallback.dns = false;
      config.resolve.fallback.fs = false;
    }

    if (!isServer && !dev && faroSourceMapEnabled) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Plugin = FaroSourceMapUploaderPlugin.default || FaroSourceMapUploaderPlugin;
      config.plugins.push(
        new Plugin({
          endpoint: FARO_SOURCE_MAP_ENDPOINT,
          appName: FARO_SOURCE_MAP_APP_NAME,
          appId: FARO_SOURCE_MAP_APP_ID,
          apiKey: FARO_SOURCE_MAP_API_KEY,
          stackId: FARO_SOURCE_MAP_STACK_ID,
          ...(FARO_BUNDLE_ID ? { bundleId: FARO_BUNDLE_ID } : {}),
          gzipContents: FARO_SOURCE_MAP_GZIP !== 'false',
          keepSourcemaps: FARO_SOURCE_MAP_KEEP_AFTER_UPLOAD === 'true',
          skipUpload: FARO_SOURCE_MAP_SKIP_UPLOAD === 'true',
          verbose: FARO_SOURCE_MAP_VERBOSE === 'true',
          nextjs: true,
        })
      );
    }

    return config;
  },
  env: {
    AD_ADDR,
    CART_ADDR,
    CHECKOUT_ADDR,
    CURRENCY_ADDR,
    PRODUCT_CATALOG_ADDR,
    PRODUCT_REVIEWS_ADDR,
    RECOMMENDATION_ADDR,
    SHIPPING_ADDR,
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    NEXT_PUBLIC_PLATFORM: ENV_PLATFORM,
    NEXT_PUBLIC_OTEL_SERVICE_NAME: OTEL_SERVICE_NAME,
    NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
  },
  images: {
    loader: "custom",
    loaderFile: "./utils/imageLoader.js"
  }
};

module.exports = nextConfig;
