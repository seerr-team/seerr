import EmbyLogo from '@app/assets/services/emby.svg';
import ImdbLogo from '@app/assets/services/imdb.svg';
import JellyfinLogo from '@app/assets/services/jellyfin.svg';
import LetterboxdLogo from '@app/assets/services/letterboxd.svg';
import PlexLogo from '@app/assets/services/plex.svg';
import RTLogo from '@app/assets/services/rt.svg';
import TmdbLogo from '@app/assets/services/tmdb.svg';
import TraktLogo from '@app/assets/services/trakt.svg';
import TvdbLogo from '@app/assets/services/tvdb.svg';
import Tooltip from '@app/components/Common/Tooltip';
import useLocale from '@app/hooks/useLocale';
import useSettings from '@app/hooks/useSettings';
import * as Icons from '@heroicons/react/24/outline';
import { MediaType } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import type { CustomMovieLink } from '@server/interfaces/api/settingsInterfaces';

interface ExternalLinkBlockProps {
  mediaType: 'movie' | 'tv';
  tmdbId?: number;
  tvdbId?: number;
  imdbId?: string;
  rtUrl?: string;
  mediaUrl?: string;
  title: string;
  releaseDate?: string;
  customLinks: CustomMovieLink[];
}

function processCustomMovieLinkUrl(
  url: string,
  tmdbId: string,
  imdbId: string,
  title: string,
  releaseDate: string
) {
  url = url.replace(/{TMDB_ID}/g, tmdbId.toString());
  url = url.replace(/{IMDB_ID}/g, imdbId || '');
  title = title
    .replace(/[^A-Za-z0-9-]/g, ' ')
    .replace(/ +/g, ' ')
    .trim();
  url = url.replace(/{TITLE}/g, encodeURIComponent(title));
  return url.replace(
    /{YEAR}/g,
    encodeURIComponent(releaseDate?.slice(0, 4) || '')
  );
}

const ExternalLinkBlock = ({
  mediaType,
  tmdbId,
  tvdbId,
  imdbId,
  rtUrl,
  mediaUrl,
  title,
  releaseDate,
  customLinks,
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

      {customLinks.map((link, index) => (
        <Tooltip content={link.text} key={'customLink' + index}>
          <a
            href={`${processCustomMovieLinkUrl(
              link.url,
              tmdbId?.toString() || '',
              imdbId || '',
              title,
              releaseDate || ''
            )}`}
            className="w-8 opacity-50 transition duration-300 hover:opacity-100"
            target="_blank"
            rel="noreferrer"
          >
            {Object.entries(Icons)
              .filter(([key]) => {
                return key === link.icon;
              })
              .map(([key, Icon]) => {
                const IconComponent = Icon as React.FunctionComponent<
                  React.SVGProps<SVGSVGElement>
                >;
                return <IconComponent key={key} />;
              })}
          </a>
        </Tooltip>
      ))}
    </div>
  );
};

export default ExternalLinkBlock;
