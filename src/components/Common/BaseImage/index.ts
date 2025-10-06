// src/components/Common/BaseImage/index.ts
import type { ImageProps } from 'next/image';
import NextImage from 'next/image';
import React from 'react';

// Instead of defining our own props, extend from Next's ImageProps
const BaseImage = React.forwardRef<HTMLImageElement, ImageProps>(
  (props, ref) => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

    const modifiedSrc =
      typeof props.src === 'string' && props.src.startsWith('/')
        ? `${basePath}${props.src}`
        : props.src;

    const shouldUnoptimize =
      typeof props.src === 'string' && props.src.endsWith('.svg');

    return React.createElement(NextImage, {
      ...props,
      ref,
      src: modifiedSrc,
      unoptimized: shouldUnoptimize || props.unoptimized,
    });
  }
);

BaseImage.displayName = 'Image';

export default BaseImage;
// Re-export ImageProps type for consumers
export type { ImageProps };
