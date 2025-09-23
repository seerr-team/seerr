import Modal from '@app/components/Common/Modal';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import type { BookDetails } from '@server/models/Book';
import type { MovieDetails } from '@server/models/Movie';
import type { TvDetails } from '@server/models/Tv';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

interface BlacklistModalProps {
  externalId: number;
  type: 'movie' | 'tv' | 'collection' | 'book';
  show: boolean;
  onComplete?: () => void;
  onCancel?: () => void;
  isUpdating?: boolean;
}

const messages = defineMessages('component.BlacklistModal', {
  blacklisting: 'Blacklisting',
});

const isMovie = (
  movie: MovieDetails | TvDetails | BookDetails | null
): movie is MovieDetails => {
  if (!movie) return false;
  return (movie as MovieDetails).title !== undefined;
};

const isBook = (
  item: MovieDetails | TvDetails | BookDetails | null
): item is BookDetails => {
  if (!item) return false;
  return (item as BookDetails).id !== undefined && 'author' in item;
};

const BlacklistModal = ({
  externalId,
  type,
  show,
  onComplete,
  onCancel,
  isUpdating,
}: BlacklistModalProps) => {
  const intl = useIntl();
  const [data, setData] = useState<
    TvDetails | MovieDetails | BookDetails | null
  >(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      if (!show) return;
      try {
        setError(null);
        const response = await axios.get(`/api/v1/${type}/${externalId}`);
        setData(response.data);
      } catch (err) {
        setError(err);
      }
    })();
  }, [show, externalId, type]);

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
        title={`${intl.formatMessage(globalMessages.blacklist)} ${
          type === 'book'
            ? intl.formatMessage(globalMessages.book)
            : type === 'movie'
            ? intl.formatMessage(globalMessages.movie)
            : intl.formatMessage(globalMessages.tvshow)
        }`}
        subTitle={`${
          isMovie(data) ? data.title : isBook(data) ? data.title : data?.name
        }`}
        onCancel={onCancel}
        onOk={onComplete}
        okText={
          isUpdating
            ? intl.formatMessage(messages.blacklisting)
            : intl.formatMessage(globalMessages.blacklist)
        }
        okButtonType="danger"
        okDisabled={isUpdating}
        backdrop={data?.backdropPath}
        cache={type === 'book' ? 'hardcover' : 'tmdb'}
      />
    </Transition>
  );
};

export default BlacklistModal;
