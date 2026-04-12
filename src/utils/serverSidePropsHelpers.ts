import type {
  GetServerSidePropsContext,
  NextPageContext,
  PreviewData,
} from 'next';
import type { ParsedUrlQuery } from 'querystring';

export const getAuthHeaders = (
  ctx: NextPageContext | GetServerSidePropsContext<ParsedUrlQuery, PreviewData>
) => {
  if (!(ctx.req && ctx.req.headers)) {
    return undefined;
  }

  const forwardAuthVars: {
    [key: string]: string | string[] | undefined;
  } = {};

  const forwardAuth = ctx.req?.forwardAuth;

  if (forwardAuth) {
    const { userHeader, emailHeader } = forwardAuth;

    if (ctx.req.headers[userHeader]) {
      forwardAuthVars[userHeader] = ctx.req.headers[userHeader];
    }
    if (ctx.req.headers[emailHeader]) {
      forwardAuthVars[emailHeader] = ctx.req.headers[emailHeader];
    }
  }

  return {
    ...(ctx.req.headers.cookie && {
      cookie: ctx.req.headers.cookie,
    }),
    ...forwardAuthVars,
  };
};
