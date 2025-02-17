import type {
  GetServerSidePropsContext,
  NextPageContext,
  PreviewData,
} from 'next';
import type { ParsedUrlQuery } from 'querystring';
import { ForwardAuthAllowlist } from './forwardAuthList';

export const getAuthHeaders = (
  ctx: NextPageContext | GetServerSidePropsContext<ParsedUrlQuery, PreviewData>
) => {
  if (!(ctx.req && ctx.req.headers)) {
    return undefined;
  }

  const forwardAuthVars: {
    [key: string]: string | string[] | undefined;
  } = {};
  for (const header of ForwardAuthAllowlist) {
    if (ctx.req.headers[header]) {
      forwardAuthVars[header] = ctx.req.headers[header] as string;
    }
  }

  return {
    ...(ctx.req.headers.cookie && {
      cookie: ctx.req.headers.cookie,
    }),
    ...(ctx.req.headers['x-forwarded-for'] && {
      'x-forwarded-for': ctx.req.headers['x-forwarded-for'] as string,
    }),
    ...forwardAuthVars,
  };
};
