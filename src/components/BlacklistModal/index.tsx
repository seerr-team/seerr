import Modal from '@app/components/Common/Modal';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import type { MovieDetails } from '@server/models/Movie';
import type { MusicDetails } from '@server/models/Music';
import type { TvDetails } from '@server/models/Tv';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

interface BlacklistModalProps {
  tmdbId?: number;
  mbId?: string;
  type: 'movie' | 'tv' | 'collection' | 'music';
  show: boolean;
  onComplete?: () => void;
  onCancel?: () => void;
  isUpdating?: boolean;
}

const messages = defineMessages('component.BlacklistModal', {
  blacklisting: 'Blacklisting',
});

const isMovie = (
  media: MovieDetails | TvDetails | MusicDetails | null
): media is MovieDetails => {
  if (!media) return false;
  return (
    (media as MovieDetails).title !== undefined && !('artistName' in media)
  );
};

const isMusic = (
  media: MovieDetails | TvDetails | MusicDetails | null
): media is MusicDetails => {
  if (!media) return false;
  return (media as MusicDetails).artistId !== undefined;
};

const BlacklistModal = ({
  tmdbId,
  mbId,
  type,
  show,
  onComplete,
  onCancel,
  isUpdating,
}: BlacklistModalProps) => {
  const intl = useIntl();
  const [data, setData] = useState<
    MovieDetails | TvDetails | MusicDetails | null
  >(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      if (!show) return;
      try {
        setError(null);
        const response = await axios.get(`/api/v1/${type}/${type === 'music' ? mbId : tmdbId}`);
        setData(response.data);
      } catch (err) {
        setError(err);
      }
    })();
  }, [show, tmdbId, mbId, type]);

  const getTitle = () => {
    if (isMusic(data)) {
      return `${data.artist.artistName} - ${data.title}`;
    }
    return isMovie(data) ? data.title : data?.name;
  };

  const getMediaType = () => {
    if (isMusic(data)) {
      return intl.formatMessage(globalMessages.music);
    }
    return isMovie(data)
      ? intl.formatMessage(globalMessages.movie)
      : intl.formatMessage(globalMessages.tvshow);
  };

  const getBackdrop = () => {
    if (isMusic(data)) {
      return data.artist.images?.find((img) => img.CoverType === 'Fanart')?.Url;
    }
    return `https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${data?.backdropPath}`;
  };

  return (
    <Transition
      as="div"
      enter="transition-opacity duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
      show={show}
    >
      <Modal
        loading={!data && !error}
        backgroundClickable
        title={`${intl.formatMessage(
          globalMessages.blacklist
        )} ${getMediaType()}`}
        subTitle={getTitle()}
        onCancel={onCancel}
        onOk={onComplete}
        okText={
          isUpdating
            ? intl.formatMessage(messages.blacklisting)
            : intl.formatMessage(globalMessages.blacklist)
        }
        okButtonType="danger"
        okDisabled={isUpdating}
        backdrop={getBackdrop()}
      />
    </Transition>
  );
};

export default BlacklistModal;
