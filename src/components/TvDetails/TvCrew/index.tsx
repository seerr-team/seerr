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

const messages = defineMessages('components.TvDetails.TvCrew', {
  fullseriescrew: 'Full Series Crew',
});

const TvCrew = () => {
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
        title={[intl.formatMessage(messages.fullseriescrew), data.name]}
      />
      <div className="mt-1 mb-5">
        <Header
          subtext={
            <Link href={`/tv/${data.id}`} className="hover:underline">
              {data.name}
            </Link>
          }
        >
          {intl.formatMessage(messages.fullseriescrew)}
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

export default TvCrew;
