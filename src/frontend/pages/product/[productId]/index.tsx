// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useCallback, useState, useEffect } from 'react';
import { dehydrate, DehydratedState, QueryClient, useQuery } from '@tanstack/react-query';
import Ad from '../../../components/Ad';
import Layout from '../../../components/Layout';
import ProductPrice from '../../../components/ProductPrice';
import Recommendations from '../../../components/Recommendations';
import ProductReviews from '../../../components/ProductReviews';
import Select from '../../../components/Select';
import { CypressFields } from '../../../utils/enums/CypressFields';
import ApiGateway from '../../../gateways/Api.gateway';
import { Product } from '../../../protos/demo';
import AdProvider from '../../../providers/Ad.provider';
import { useCart } from '../../../providers/Cart.provider';
import * as S from '../../../styles/ProductDetail.styled';
import { useCurrency } from '../../../providers/Currency.provider';
import ProductReviewProvider from '../../../providers/ProductReview.provider';
import ProductAIAssistantProvider from '../../../providers/ProductAIAssistant.provider';

const quantityOptions = new Array(10).fill(0).map((_, i) => i + 1);

// The selected currency lives in a client cookie/context that isn't available
// during SSR, so the server renders in the default currency. The client only
// re-fetches if the visitor has actually picked a different one.
const DEFAULT_CURRENCY = 'USD';

interface IProps {
  product: Product;
}

type IServerProps = IProps & {
  dehydratedState: DehydratedState;
};

const ProductDetail: NextPage<IProps> = ({ product: ssrProduct }) => {
  const { push, query } = useRouter();
  const [quantity, setQuantity] = useState(1);
  const {
    addItem,
    cart: { items },
  } = useCart();
  const { selectedCurrency } = useCurrency();
  const productId = query.productId as string;

  useEffect(() => {
    setQuantity(1);
  }, [productId]);

  const {
    data: {
      name,
      picture,
      description,
      priceUsd = { units: 0, currencyCode: 'USD', nanos: 0 },
      categories,
    } = (ssrProduct ?? {}) as Product,
  } = useQuery({
      queryKey: ['product', productId, 'selectedCurrency', selectedCurrency],
      queryFn: () => ApiGateway.getProduct(productId, selectedCurrency),
      enabled: !!productId,
      // Seed the first server + client render with the product fetched in
      // getServerSideProps so the details are in the initial HTML and survive
      // hydration instead of relying on a client fetch (which the tracing-path
      // error could break, leaving the page blank). staleTime avoids an
      // immediate refetch on mount.
      initialData: ssrProduct,
      staleTime: 60 * 1000,
    }
  ) as { data: Product };

  const onAddItem = useCallback(async () => {
    await addItem({
      productId,
      quantity,
    });
    push('/cart');
  }, [addItem, productId, quantity, push]);

  return (
    <AdProvider
      productIds={[productId, ...items.map(({ productId }) => productId)]}
      contextKeys={[...new Set(categories)]}
    >
      <Head>
        <title>Otel Demo - Product</title>
      </Head>
      <Layout>
        <S.ProductDetail data-cy={CypressFields.ProductDetail}>
          <S.Container>
            {picture ? (
              <S.Image
                $src={`/images/products/${picture}`}
                data-cy={CypressFields.ProductPicture}
              />
            ) : null}
            <S.Details $fullWidth={!picture}>
              <S.Name data-cy={CypressFields.ProductName}>{name}</S.Name>
              <S.Description data-cy={CypressFields.ProductDescription}>{description}</S.Description>
              <S.ProductPrice>
                <ProductPrice price={priceUsd} />
              </S.ProductPrice>
              <S.Text>Quantity</S.Text>
              <Select
                data-cy={CypressFields.ProductQuantity}
                onChange={event => setQuantity(+event.target.value)}
                value={quantity}
              >
                {quantityOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              <S.AddToCart data-cy={CypressFields.ProductAddToCart} onClick={onAddItem}>
                <Image src="/icons/Cart.svg" height="15" width="15" alt="cart" /> Add To Cart
              </S.AddToCart>
            </S.Details>
          </S.Container>
          {productId && (
              <ProductAIAssistantProvider productId={productId}>
                <ProductReviewProvider productId={productId}>
                  <ProductReviews />
                </ProductReviewProvider>
              </ProductAIAssistantProvider>
          )}
          <Recommendations />
        </S.ProductDetail>
        <Ad />
      </Layout>
    </AdProvider>
  );
};

export const getServerSideProps: GetServerSideProps<IServerProps> = async ({ params }) => {
  const productId = (params?.productId as string) ?? '';

  // Server-only gRPC gateways; lazily imported so they never reach the browser
  // bundle. Reusing the same services the BFF /api routes use guarantees the SSR
  // payload has the exact shape the client expects, keeping hydration clean.
  const { default: ProductCatalogService } = await import('../../../services/ProductCatalog.service');
  const { default: ProductReviewService } = await import('../../../services/ProductReview.service');

  const product = await ProductCatalogService.getProduct(productId, DEFAULT_CURRENCY);

  // Prefetch the product, its reviews and average score into a per-request
  // QueryClient and ship the dehydrated cache. _app.tsx's <HydrationBoundary>
  // seeds these exact query keys, so both the product details and the reviews
  // panel render in the initial HTML instead of via client-side fetches — which
  // is what previously left them blank. Reviews are best-effort so a hiccup in
  // that backend can't blank the whole product page.
  const queryClient = new QueryClient();
  queryClient.setQueryData(['product', productId, 'selectedCurrency', DEFAULT_CURRENCY], product);

  try {
    const [reviews, averageScore] = await Promise.all([
      ProductReviewService.getProductReviews(productId),
      ProductReviewService.getAverageProductReviewScore(productId),
    ]);
    queryClient.setQueryData(['productReviews', productId], reviews);
    queryClient.setQueryData(['productReviewAvgScore', productId], averageScore);
  } catch {
    // Leave reviews to the client; the product itself still renders server-side.
  }

  return {
    props: {
      product,
      dehydratedState: dehydrate(queryClient),
    },
  };
};

export default ProductDetail;
