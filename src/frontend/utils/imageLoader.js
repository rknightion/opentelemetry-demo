// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0
/*
 * Custom Next.js image loader. We emit a path-only URL so requests resolve
 * against window.location.origin in the browser and the SSR output matches
 * what the client computes during hydration. The path is served by the envoy
 * frontend-proxy, which forwards image-provider routes and lets Next.js public
 * assets fall through to the frontend. src already starts with a leading slash.
 */

export default function imageLoader({ src, width, quality }) {
  return `${src}?w=${width}&q=${quality || 75}`;
}
