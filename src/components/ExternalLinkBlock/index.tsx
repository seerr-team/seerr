import EmbyLogo from '@app/assets/services/emby.svg';
import ImdbLogo from '@app/assets/services/imdb.svg';
import JellyfinLogo from '@app/assets/services/jellyfin.svg';
import LetterboxdLogo from '@app/assets/services/letterboxd.svg';
import PlexLogo from '@app/assets/services/plex.svg';
import RTLogo from '@app/assets/services/rt.svg';
import TmdbLogo from '@app/assets/services/tmdb.svg';
import TraktLogo from '@app/assets/services/trakt.svg';
import TvdbLogo from '@app/assets/services/tvdb.svg';
import useLocale from '@app/hooks/useLocale';
import useSettings from '@app/hooks/useSettings';
import { MediaType } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';

interface ExternalLinkBlockProps {
  mediaType: 'movie' | 'tv' | 'music';
  tmdbId?: number;
  tvdbId?: number;
  imdbId?: string;
  rtUrl?: string;
  mediaUrl?: string;
}

const ExternalLinkBlock = ({
  mediaType,
  tmdbId,
  tvdbId,
  imdbId,
  rtUrl,
  mediaUrl,
}: ExternalLinkBlockProps) => {
  const settings = useSettings();
  const { locale } = useLocale();

  return (
    <div className="flex w-full items-center justify-center space-x-5">
      {mediaUrl && (
        <a
          href={mediaUrl}
          className="w-12 opacity-50 transition duration-300 hover:opacity-100"
          target="_blank"
          rel="noreferrer"
        >
          {settings.currentSettings.mediaServerType === MediaServerType.PLEX ? (
            <PlexLogo />
          ) : settings.currentSettings.mediaServerType ===
            MediaServerType.EMBY ? (
            <EmbyLogo />
          ) : (
            <JellyfinLogo />
          )}
        </a>
      )}
      {tmdbId && (
        <a
          href={`https://www.themoviedb.org/${mediaType}/${tmdbId}?language=${locale}`}
          className="w-8 opacity-50 transition duration-300 hover:opacity-100"
          target="_blank"
          rel="noreferrer"
        >
          <TmdbLogo />
        </a>
      )}
      {tvdbId && mediaType === MediaType.TV && (
        <a
          href={`http://www.thetvdb.com/?tab=series&id=${tvdbId}`}
          className="w-9 opacity-50 transition duration-300 hover:opacity-100"
          target="_blank"
          rel="noreferrer"
        >
          <TvdbLogo />
        </a>
      )}
      {imdbId && (
        <a
          href={`https://www.imdb.com/title/${imdbId}`}
          className="w-8 opacity-50 transition duration-300 hover:opacity-100"
          target="_blank"
          rel="noreferrer"
        >
          <ImdbLogo />
        </a>
      )}
      {rtUrl && (
        <a
          href={rtUrl}
          className="w-14 opacity-50 transition duration-300 hover:opacity-100"
          target="_blank"
          rel="noreferrer"
        >
          <RTLogo />
        </a>
      )}
      {tmdbId && (
        <a
          href={`https://trakt.tv/search/tmdb/${tmdbId}?id_type=${
            mediaType === 'movie' ? 'movie' : 'show'
          }`}
          className="w-8 opacity-50 transition duration-300 hover:opacity-100"
          target="_blank"
          rel="noreferrer"
        >
          <TraktLogo />
        </a>
      )}
      {tmdbId && mediaType === MediaType.MOVIE && (
        <a
          href={`https://letterboxd.com/tmdb/${tmdbId}`}
          className="w-8 opacity-50 transition duration-300 hover:opacity-100"
          target="_blank"
          rel="noreferrer"
        >
          <LetterboxdLogo />
        </a>
      )}
    </div>
  );
};

export default ExternalLinkBlock;
