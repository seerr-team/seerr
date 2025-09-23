import CachedImage from '@app/components/Common/CachedImage';
import type { ForwardRefRenderFunction, HTMLAttributes } from 'react';
import React, { useEffect, useState } from 'react';

interface ImageFaderProps extends HTMLAttributes<HTMLDivElement> {
  backgroundImages: string[];
  rotationSpeed?: number;
  isDarker?: boolean;
  forceOptimize?: boolean;
  cache?: 'tmdb' | 'avatar' | 'hardcover' | 'tvdb';
}

const DEFAULT_ROTATION_SPEED = 6000;

const ImageFader: ForwardRefRenderFunction<HTMLDivElement, ImageFaderProps> = (
  {
    backgroundImages,
    cache = 'tmdb',
    rotationSpeed = DEFAULT_ROTATION_SPEED,
    isDarker,
    forceOptimize,
    ...props
  },
  ref
) => {
  const [activeIndex, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () => setIndex((ai) => (ai + 1) % backgroundImages.length),
      rotationSpeed
    );

    return () => {
      clearInterval(interval);
    };
  }, [backgroundImages, rotationSpeed]);

  let gradient =
    'linear-gradient(180deg, rgba(45, 55, 72, 0.47) 0%, #1A202E 100%)';

  if (isDarker) {
    gradient =
      'linear-gradient(180deg, rgba(17, 24, 39, 0.47) 0%, rgba(17, 24, 39, 1) 100%)';
  }

  let overrides = {};

  if (forceOptimize) {
    overrides = {
      unoptimized: false,
    };
  }

  return (
    <div ref={ref}>
      {backgroundImages.map((imageUrl, i) => (
        <div
          key={`banner-image-${i}`}
          className={`absolute-top-shift absolute inset-0 bg-cover bg-center transition-opacity duration-300 ease-in ${
            i === activeIndex ? 'opacity-100' : 'opacity-0'
          }`}
          {...props}
        >
          <CachedImage
            type={cache}
            className="absolute inset-0 h-full w-full"
            alt=""
            src={imageUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            fill
            {...overrides}
          />
          <div
            className="absolute inset-0"
            style={{ backgroundImage: gradient }}
          />
        </div>
      ))}
    </div>
  );
};

export default React.forwardRef<HTMLDivElement, ImageFaderProps>(ImageFader);
