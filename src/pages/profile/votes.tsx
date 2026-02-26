import VoteHistory from '@app/components/UserProfile/VoteHistory';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const UserVoteHistoryPage: NextPage = () => {
  useRouteGuard(Permission.VOTE);

  return <VoteHistory />;
};

export default UserVoteHistoryPage;
