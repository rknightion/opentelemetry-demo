// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import * as S from './PlatformFlag.styled';

const { NEXT_PUBLIC_PLATFORM = 'local' } = typeof window !== 'undefined' ? window.ENV : {};

const platform = NEXT_PUBLIC_PLATFORM;

const PlatformFlag = () => {
  // `platform` is read from window.ENV on the client but falls back to 'local'
  // during SSR, so the two renders can differ per deployment. Suppress the
  // hydration warning so this mismatch doesn't trigger React #418 and a full
  // client re-render of the tree.
  return (
    <S.Block suppressHydrationWarning>{platform}</S.Block>
  );
};

export default PlatformFlag;
