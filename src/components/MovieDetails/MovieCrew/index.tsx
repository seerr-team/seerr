import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import PersonCard from '@app/components/PersonCard';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { MovieDetails } from '@server/models/Movie';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.MovieDetails.MovieCrew', {
  fullcrew: 'Full Crew',
});

const MovieCrew = () => {
  const router = useRouter();
  const intl = useIntl();
  const { data, error } = useSWR<MovieDetails>(
    `/api/v1/movie/${router.query.movieId}`
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <Error statusCode={404} />;
  }

  return (
    <>
      <PageTitle title={[intl.formatMessage(messages.fullcrew), data.title]} />
      <div className="mt-1 mb-5">
        <Header
          subtext={
            <Link href={`/movie/${data.id}`} className="hover:underline">
              {data.title}
            </Link>
          }
        >
          {intl.formatMessage(messages.fullcrew)}
        </Header>
      </div>
      <ul className="cards-vertical">
        {data?.credits.crew.map((person, index) => {
          return (
            <li key={`crew-${person.id}-${index}`}>
              <PersonCard
                name={person.name}
                personId={person.id}
                subName={person.job}
                profilePath={person.profilePath}
                canExpand
              />
            </li>
          );
        })}
      </ul>
    </>
  );
};

export default MovieCrew;
