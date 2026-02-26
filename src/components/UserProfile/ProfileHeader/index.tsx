import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import type { User } from '@app/hooks/useUser';
import { Permission, useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { CogIcon, UserIcon } from '@heroicons/react/24/solid';
import Link from 'next/link';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.UserProfile.ProfileHeader', {
  settings: 'Edit Settings',
  profile: 'View Profile',
  joindate: 'Joined {joindate}',
  userid: 'User ID: {userid}',
});

interface ProfileHeaderProps {
  user: User;
  isSettingsPage?: boolean;
}

const ProfileHeader = ({ user, isSettingsPage }: ProfileHeaderProps) => {
  const intl = useIntl();
  const { user: loggedInUser, hasPermission } = useUser();

  const subtextItems: React.ReactNode[] = [
    intl.formatMessage(messages.joindate, {
      joindate: intl.formatDate(user.createdAt, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    }),
  ];

  if (hasPermission(Permission.MANAGE_REQUESTS)) {
    subtextItems.push(intl.formatMessage(messages.userid, { userid: user.id }));
  }

  return (
    <div className="relative z-40 mt-6 mb-12 lg:flex lg:items-end lg:justify-between lg:space-x-5">
      <div className="flex items-end justify-items-end space-x-5">
        <div className="shrink-0">
          <div className="relative">
            <CachedImage
              type="avatar"
              className="h-24 w-24 rounded-full bg-gray-600 object-cover ring-1 ring-gray-700"
              src={user.avatar}
              alt=""
              width={96}
              height={96}
            />
            <span
              className="absolute inset-0 rounded-full shadow-inner"
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="pt-1.5">
          <h1 className="mb-1 flex flex-col sm:flex-row sm:items-center">
            <Link
              href={
                user.id === loggedInUser?.id ? '/profile' : `/users/${user.id}`
              }
              className="text-overseerr text-lg font-bold hover:to-purple-200 sm:text-2xl"
            >
              {user.displayName}
            </Link>
            {user.email && user.displayName.toLowerCase() !== user.email && (
              <span className="text-sm text-gray-400 sm:ml-2 sm:text-lg">
                ({user.email})
              </span>
            )}
          </h1>
          <p className="text-sm font-medium text-gray-400">
            {subtextItems.reduce((prev, curr) => (
              <>
                {prev} | {curr}
              </>
            ))}
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse justify-stretch space-y-4 space-y-reverse lg:flex-row lg:justify-end lg:space-y-0 lg:space-x-3 lg:space-x-reverse">
        {(loggedInUser?.id === user.id ||
          (user.id !== 1 && hasPermission(Permission.MANAGE_USERS))) &&
        !isSettingsPage ? (
          <Link
            href={
              loggedInUser?.id === user.id
                ? `/profile/settings`
                : `/users/${user.id}/settings`
            }
            passHref
            legacyBehavior
          >
            <Button as="a">
              <CogIcon />
              <span>{intl.formatMessage(messages.settings)}</span>
            </Button>
          </Link>
        ) : (
          isSettingsPage && (
            <Link
              href={
                loggedInUser?.id === user.id ? `/profile` : `/users/${user.id}`
              }
              passHref
              legacyBehavior
            >
              <Button as="a">
                <UserIcon />
                <span>{intl.formatMessage(messages.profile)}</span>
              </Button>
            </Link>
          )
        )}
      </div>
    </div>
  );
};

export default ProfileHeader;
