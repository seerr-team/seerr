import useSettings from '@app/hooks/useSettings';
import type { ImageLoader, ImageProps } from 'next/image';
import Image from 'next/image';
import { useState } from 'react';

const imageLoader: ImageLoader = ({ src }) => src;

export type CachedImageProps = ImageProps & {
  src: string;
  type: 'tmdb' | 'avatar' | 'music' | 'tvdb';
};

/**
 * The CachedImage component should be used wherever
 * we want to offer the option to locally cache images.
 **/
const CachedImage = ({ src, type, ...props }: CachedImageProps) => {
  const { currentSettings } = useSettings();
  const [, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  let imageUrl: string;
  let fallbackImage = '';

  if (type === 'tmdb') {
    // tmdb stuff
    imageUrl =
      currentSettings.cacheImages && !src.startsWith('/')
        ? src.replace(/^https:\/\/image\.tmdb\.org\//, '/imageproxy/tmdb/')
        : src;
  } else if (type === 'tvdb') {
    imageUrl =
      currentSettings.cacheImages && !src.startsWith('/')
        ? src.replace(
            /^https:\/\/artworks\.thetvdb\.com\//,
            '/imageproxy/tvdb/'
          )
        : src;
    fallbackImage = '/images/jellyseerr_poster_not_found.png';
  } else if (type === 'music') {
    // Cover Art Archive and TheAudioDB images
    imageUrl = src.startsWith('https://archive.org/')
      ? src.replace(/^https:\/\/archive\.org\//, '/caaproxy/')
      : currentSettings.cacheImages &&
        !src.startsWith('/') &&
        src.startsWith('https://r2.theaudiodb.com/')
      ? src.replace(/^https:\/\/r2\.theaudiodb\.com\//, '/tadbproxy/')
      : src;
    fallbackImage = '/images/jellyseerr_poster_not_found_square.png';
  } else if (type === 'avatar') {
    imageUrl = src;
    fallbackImage = '/images/user_placeholder.png';
  } else {
    return null;
  }

  const displaySrc = isError ? fallbackImage : imageUrl;

  return (
    <Image
      unoptimized
      loader={imageLoader}
      src={displaySrc}
      {...props}
      onLoad={() => setIsLoading(false)}
      onError={() => {
        setIsError(true);
        setIsLoading(false);
      }}
    />
  );
};

export default CachedImage;
