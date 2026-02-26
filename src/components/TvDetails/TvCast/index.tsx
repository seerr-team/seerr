import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import PersonCard from '@app/components/PersonCard';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { TvDetails } from '@server/models/Tv';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.TvDetails.TvCast', {
  fullseriescast: 'Full Series Cast',
});

const TvCast = () => {
  const router = useRouter();
  const intl = useIntl();
  const { data, error } = useSWR<TvDetails>(`/api/v1/tv/${router.query.tvId}`);

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <Error statusCode={404} />;
  }

  return (
    <>
      <PageTitle
        title={[intl.formatMessage(messages.fullseriescast), data.name]}
      />
      <div className="mt-1 mb-5">
        <Header
          subtext={
            <Link href={`/tv/${data.id}`} className="hover:underline">
              {data.name}
            </Link>
          }
        >
          {intl.formatMessage(messages.fullseriescast)}
        </Header>
      </div>
      <ul className="cards-vertical">
        {data?.credits.cast.map((person) => {
          return (
            <li key={person.id}>
              <PersonCard
                name={person.name}
                personId={person.id}
                subName={person.character}
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

export default TvCast;
