import useSettings from '@app/hooks/useSettings';
import { MediaServerType } from '@server/constants/server';
import { useEffect, useState } from 'react';

interface useDeepLinksProps {
  mediaUrl?: string;
  mediaUrlAlt?: string;
  iOSPlexUrl?: string;
  iOSPlexUrlAlt?: string;
}

const useDeepLinks = ({
  mediaUrl,
  mediaUrlAlt,
  iOSPlexUrl,
  iOSPlexUrlAlt,
}: useDeepLinksProps) => {
  const [returnedMediaUrl, setReturnedMediaUrl] = useState(mediaUrl);
  const [returnedMediaUrlAlt, setReturnedMediaUrlAlt] = useState(mediaUrlAlt);
  const settings = useSettings();

  useEffect(() => {
    if (
      settings.currentSettings.mediaServerType === MediaServerType.PLEX &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1))
    ) {
      setReturnedMediaUrl(iOSPlexUrl);
      setReturnedMediaUrlAlt(iOSPlexUrlAlt);
    } else {
      setReturnedMediaUrl(mediaUrl);
      setReturnedMediaUrlAlt(mediaUrlAlt);
    }
  }, [
    iOSPlexUrl,
    iOSPlexUrlAlt,
    mediaUrl,
    mediaUrlAlt,
    settings.currentSettings.mediaServerType,
  ]);

  return { mediaUrl: returnedMediaUrl, mediaUrlAlt: returnedMediaUrlAlt };
};

export default useDeepLinks;
