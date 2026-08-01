import Alert from '@app/components/Common/Alert';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import TraktConnectionActions from '@app/components/Trakt/TraktConnectionActions';
import defineMessages from '@app/utils/defineMessages';
import type { TraktConnectionResponse } from '@server/interfaces/api/traktInterfaces';
import type { UserResultsResponse } from '@server/interfaces/api/userInterfaces';
import axios from 'axios';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages(
  'components.Settings.SettingsTrakt.TraktConnectionList',
  {
    title: 'Household connections',
    description:
      'Connect a separate Trakt account for each Seerr user in this household.',
    loadFailed: 'Trakt household connections could not be loaded.',
  }
);

interface HouseholdUser {
  id: number;
  displayName: string;
  email: string;
}

const fetchAllUsers = async (): Promise<HouseholdUser[]> => {
  const users = new Map<number, HouseholdUser>();
  let skip = 0;
  let page = 0;
  let pages = 1;

  do {
    const { data } = await axios.get<UserResultsResponse>(
      `/api/v1/user?take=50&skip=${skip}`
    );
    data.results.forEach((user) =>
      users.set(user.id, {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
      })
    );
    page = data.pageInfo.page;
    pages = data.pageInfo.pages;
    skip += 50;
  } while (page < pages);

  return [...users.values()];
};

interface TraktConnectionListProps {
  applicationConfigured: boolean;
}

const TraktConnectionList = ({
  applicationConfigured,
}: TraktConnectionListProps) => {
  const intl = useIntl();
  const { data: users, error: usersError } = useSWR(
    'trakt:all-users',
    fetchAllUsers
  );
  const {
    data: connections,
    error: connectionsError,
    mutate: refreshConnections,
  } = useSWR<TraktConnectionResponse[]>('/api/v1/settings/trakt/connections');

  if ((!users && !usersError) || (!connections && !connectionsError)) {
    return <LoadingSpinner />;
  }

  if (usersError || connectionsError || !users || !connections) {
    return (
      <Alert title={intl.formatMessage(messages.loadFailed)} type="error" />
    );
  }

  const connectionsByUser = new Map(
    connections.map((item) => [item.userId, item])
  );

  return (
    <div className="section">
      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.title)}</h3>
        <p className="description">
          {intl.formatMessage(messages.description)}
        </p>
      </div>
      <ul className="space-y-3">
        {users.map((user) => (
          <li
            key={user.id}
            data-testid="trakt-user-row"
            className="rounded-lg bg-gray-800/50 px-4 py-4 shadow ring-1 ring-gray-700"
          >
            <div className="mb-3 min-w-0">
              <div className="truncate font-semibold text-white">
                {user.displayName}
              </div>
              <div className="truncate text-sm text-gray-400">{user.email}</div>
            </div>
            <TraktConnectionActions
              targetUserId={user.id}
              targetUserDisplayName={user.displayName}
              connection={connectionsByUser.get(user.id) ?? null}
              applicationConfigured={applicationConfigured}
              onRefresh={refreshConnections}
            />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TraktConnectionList;
