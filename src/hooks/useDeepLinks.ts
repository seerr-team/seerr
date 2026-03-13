import useSettings from '@app/hooks/useSettings';
import { MediaServerType } from '@server/constants/server';
import type { MediaLink } from '@server/entity/Media';
import { useEffect, useState } from 'react';

interface useDeepLinksProps {
  mediaUrl?: string;
  mediaUrl4k?: string;
  iOSPlexUrl?: string;
  iOSPlexUrl4k?: string;
  mediaUrls?: MediaLink[];
  mediaUrls4k?: MediaLink[];
}

const useDeepLinks = ({
  mediaUrl,
  mediaUrl4k,
  iOSPlexUrl,
  iOSPlexUrl4k,
  mediaUrls,
  mediaUrls4k,
}: useDeepLinksProps) => {
  const [returnedMediaUrl, setReturnedMediaUrl] = useState(mediaUrl);
  const [returnedMediaUrl4k, setReturnedMediaUrl4k] = useState(mediaUrl4k);
  const [returnedMediaUrls, setReturnedMediaUrls] = useState(mediaUrls);
  const [returnedMediaUrls4k, setReturnedMediaUrls4k] = useState(mediaUrls4k);
  const settings = useSettings();

  const isIOSDevice = () =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const getMappedMediaLinks = (
      links?: MediaLink[]
    ): MediaLink[] | undefined =>
      links?.map((link) =>
        link.mediaServerType === MediaServerType.PLEX &&
        isIOSDevice() &&
        link.iOSPlexUrl
          ? { ...link, url: link.iOSPlexUrl }
          : link
      );

    if (
      settings.currentSettings.mediaServerType === MediaServerType.PLEX &&
      isIOSDevice()
    ) {
      setReturnedMediaUrl(iOSPlexUrl);
      setReturnedMediaUrl4k(iOSPlexUrl4k);
    } else {
      setReturnedMediaUrl(mediaUrl);
      setReturnedMediaUrl4k(mediaUrl4k);
    }

    setReturnedMediaUrls(getMappedMediaLinks(mediaUrls));
    setReturnedMediaUrls4k(getMappedMediaLinks(mediaUrls4k));
  }, [
    iOSPlexUrl,
    iOSPlexUrl4k,
    mediaUrl,
    mediaUrl4k,
    mediaUrls,
    mediaUrls4k,
    settings.currentSettings.mediaServerType,
  ]);

  return {
    mediaUrl: returnedMediaUrl,
    mediaUrl4k: returnedMediaUrl4k,
    mediaUrls: returnedMediaUrls,
    mediaUrls4k: returnedMediaUrls4k,
  };
};

export default useDeepLinks;
