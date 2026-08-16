import { withBasePath } from '@app/utils/basePath';
import { useRouter } from '@app/utils/router';
import NextLink from 'next/dist/client/link';
import { resolveHref } from 'next/dist/client/resolve-href';
import React, { forwardRef } from 'react';

type BaseLinkProps = React.ComponentProps<typeof NextLink>;
type LinkUrl = BaseLinkProps['href'];

const resolveExternalAs = (
  router: ReturnType<typeof useRouter>,
  href: LinkUrl,
  as?: LinkUrl
): string => {
  if (as) {
    return withBasePath(resolveHref(router, as));
  }

  const [resolvedHref, resolvedAs] = resolveHref(router, href, true);
  return withBasePath(resolvedAs ?? resolvedHref);
};

const BaseLink = forwardRef<HTMLAnchorElement, BaseLinkProps>(
  ({ href, as, ...props }, ref) => {
    const router = useRouter();

    return (
      <NextLink
        {...props}
        ref={ref}
        href={href}
        as={resolveExternalAs(router, href, as)}
      />
    );
  }
);

BaseLink.displayName = 'BaseLink';

export default BaseLink;
export type { LinkProps } from 'next/dist/client/link';
