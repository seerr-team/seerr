import useSettings from '@app/hooks/useSettings';
import type { ImageLoader, ImageProps } from 'next/image';
import Image from 'next/image';

const imageLoader: ImageLoader = ({ src }) => src;

export type CachedImageProps = ImageProps & {
  src: string;
  type: 'tmdb' | 'avatar' | 'tvdb' | 'music';
};

/**
 * The CachedImage component should be used wherever
 * we want to offer the option to locally cache images.
 **/
const CachedImage = ({ src, type, ...props }: CachedImageProps) => {
  const { currentSettings } = useSettings();

  let imageUrl: string;

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
  } else if (type === 'avatar') {
    // jellyfin avatar (if any)
    imageUrl = src;
  } else if (type === 'music') {
    // Handle CAA, Fanart and Lidarr images
    imageUrl = /^https?:\/\/coverartarchive\.org\//.test(src)
      ? src.replace(/^https?:\/\/coverartarchive\.org\//, '/caaproxy/')
      : /^https?:\/\/assets\.fanart\.tv\//.test(src)
      ? src.replace(/^https?:\/\/assets\.fanart\.tv\//, '/fanartproxy/')
      : currentSettings.cacheImages
      ? src.replace(/^https:\/\/imagecache\.lidarr\.audio\//, '/lidarrproxy/')
      : src;
  } else {
    return null;
  }

  return <Image unoptimized loader={imageLoader} src={imageUrl} {...props} />;
};

export default CachedImage;
