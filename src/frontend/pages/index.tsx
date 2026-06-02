// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import Layout from '../components/Layout';
import ProductList from '../components/ProductList';
import * as S from '../styles/Home.styled';
import { dehydrate, DehydratedState, QueryClient, useQuery } from '@tanstack/react-query';
import ApiGateway from '../gateways/Api.gateway';
import Banner from '../components/Banner';
import { CypressFields } from '../utils/enums/CypressFields';
import { useCurrency } from '../providers/Currency.provider';
import { Product } from '../protos/demo';

// The selected currency lives in a client cookie/context that isn't available
// during SSR, so we render the catalog in the default currency on the server.
// The client re-fetches only if the visitor has actually picked something else.
const DEFAULT_CURRENCY = 'USD';

interface IProps {
  productList: Product[];
}

// getServerSideProps additionally ships the dehydrated react-query cache, which
// _app.tsx hands to its <HydrationBoundary>.
type IServerProps = IProps & {
  dehydratedState: DehydratedState;
};

const Home: NextPage<IProps> = ({ productList: ssrProductList }) => {
  const { selectedCurrency } = useCurrency();
  const { data: productList = [] } = useQuery({
    queryKey: ['products', selectedCurrency],
    queryFn: () => ApiGateway.listProducts(selectedCurrency),
    // Seed every render (server and the first client paint) with the products
    // fetched in getServerSideProps so the "Hot Products" grid is present in the
    // initial HTML and survives hydration instead of flashing empty while the
    // client request is in flight. staleTime keeps this data fresh long enough
    // to avoid an immediate refetch on mount.
    initialData: ssrProductList,
    staleTime: 60 * 1000,
  });

  return (
    <Layout>
      <Head>
        <title>Otel Demo - Home</title>
      </Head>
      <S.Home data-cy={CypressFields.HomePage}>
        <Banner />
        <S.Container>
          <S.Row>
            <S.Content>
              <S.HotProducts>
                <S.HotProductsTitle data-cy={CypressFields.HotProducts} id="hot-products">
                  Hot Products
                </S.HotProductsTitle>
                <ProductList productList={productList} />
              </S.HotProducts>
            </S.Content>
          </S.Row>
        </S.Container>
      </S.Home>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps<IServerProps> = async () => {
  // ProductCatalog.service talks to the product-catalog backend over gRPC and
  // must never reach the browser bundle, so it is imported lazily inside this
  // server-only function. Reusing the same service the /api/products BFF route
  // uses guarantees the SSR payload has the exact shape the client expects,
  // which keeps hydration clean (no new mismatch).
  const { default: ProductCatalogService } = await import('../services/ProductCatalog.service');
  const productList = await ProductCatalogService.listProducts(DEFAULT_CURRENCY);

  // Prefetch into a per-request QueryClient and ship the dehydrated cache so the
  // ['products', 'USD'] entry is already warm once the currency context settles
  // on the default, complementing the initialData used for the very first paint.
  const queryClient = new QueryClient();
  queryClient.setQueryData(['products', DEFAULT_CURRENCY], productList);

  return {
    props: {
      productList,
      dehydratedState: dehydrate(queryClient),
    },
  };
};

export default Home;
