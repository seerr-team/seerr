import Ellipsis from '@app/assets/ellipsis.svg';
import CachedImage from '@app/components/Common/CachedImage';
import ImageFader from '@app/components/Common/ImageFader';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import TitleCard from '@app/components/TitleCard';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { AuthorDetails as AuthorDetailsType } from '@server/models/Author';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import TruncateMarkup from 'react-truncate-markup';
import useSWR from 'swr';

const messages = defineMessages('components.AuthorDetails', {
  books: 'Books',
});

const AuthorDetails = () => {
  const intl = useIntl();
  const router = useRouter();
  const { data, error } = useSWR<AuthorDetailsType>(
    `/api/v1/author/${router.query.authorId}`
  );

  const [showBio, setShowBio] = useState(false);

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <Error statusCode={404} />;
  }

  const books = (
    <>
      <div className="slider-header">
        <div className="slider-title">
          <span>{intl.formatMessage(messages.books)}</span>
        </div>
      </div>
      <ul className="cards-vertical">
        {data.books?.map((book, index) => {
          return (
            <li key={`list-cast-item-${book.id}-${index}`}>
              <TitleCard
                key={book.id}
                id={book.id}
                title={book.title}
                year={book.releaseDate}
                image={book.posterPath}
                summary={book.overview}
                mediaType={'book'}
                status={book.mediaInfo?.status}
                canExpand
              />
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <>
      <PageTitle title={data.name} />
      {data.books && (
        <div className="absolute top-0 left-0 right-0 z-0 h-96">
          <ImageFader
            isDarker
            cache={'hardcover'}
            backgroundImages={(
              [
                ...new Set(
                  (data.books ?? [])
                    .filter((media) => media.backdropPath)
                    .map((media) => media.backdropPath)
                ),
              ] as string[]
            ).slice(0, 6)}
          />
        </div>
      )}
      <div
        className={`relative z-10 mt-4 mb-8 flex flex-col items-center lg:flex-row ${
          data.bio ? 'lg:items-start' : ''
        }`}
      >
        {data.posterPath && (
          <div className="relative mb-6 mr-0 h-36 w-36 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-gray-700 lg:mb-0 lg:mr-6 lg:h-44 lg:w-44">
            <CachedImage
              type="hardcover"
              src={`${data.posterPath}`}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              fill
            />
          </div>
        )}
        <div className="text-center text-gray-300 lg:text-left">
          <h1 className="text-3xl text-white lg:text-4xl">{data.name}</h1>
          <div className="mt-1 mb-2 space-y-1 text-xs text-white sm:text-sm lg:text-base"></div>
          {data.bio && (
            <div className="relative text-left">
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
              <div
                className="group outline-none ring-0"
                onClick={() => setShowBio((show) => !show)}
                role="button"
                tabIndex={-1}
              >
                <TruncateMarkup
                  lines={showBio ? 200 : 6}
                  ellipsis={
                    <Ellipsis className="relative -top-0.5 ml-2 inline-block opacity-70 transition duration-300 group-hover:opacity-100" />
                  }
                >
                  <p className="pt-2 text-sm lg:text-base">{data.bio}</p>
                </TruncateMarkup>
              </div>
            </div>
          )}
        </div>
      </div>
      {books}
    </>
  );
};

export default AuthorDetails;
