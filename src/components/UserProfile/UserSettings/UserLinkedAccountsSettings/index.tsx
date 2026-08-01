import EmbyLogo from '@app/assets/services/emby-icon-only.svg';
import JellyfinLogo from '@app/assets/services/jellyfin-icon.svg';
import PlexLogo from '@app/assets/services/plex.svg';
import TraktLogo from '@app/assets/services/trakt.svg';
import Alert from '@app/components/Common/Alert';
import Badge from '@app/components/Common/Badge';
import ConfirmButton from '@app/components/Common/ConfirmButton';
import Dropdown from '@app/components/Common/Dropdown';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import TraktConnectionActions, {
  traktAccountName,
} from '@app/components/Trakt/TraktConnectionActions';
import LinkJellyfinQuickConnectModal from '@app/components/UserProfile/UserSettings/UserLinkedAccountsSettings/LinkJellyfinQuickConnectModal';
import useSettings from '@app/hooks/useSettings';
import { Permission, UserType, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import PlexOAuth from '@app/utils/plex';
import { TrashIcon } from '@heroicons/react/24/solid';
import { MediaServerType } from '@server/constants/server';
import type { TraktUserSettingsResponse } from '@server/interfaces/api/traktInterfaces';
import axios from 'axios';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';
import LinkJellyfinModal from './LinkJellyfinModal';

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserLinkedAccountsSettings',
  {
    linkedAccounts: 'Linked Accounts',
    linkedAccountsHint:
      'These external accounts are linked to your {applicationName} account.',
    noLinkedAccounts:
      'You do not have any external accounts linked to your account.',
    noPermissionDescription:
      "You do not have permission to modify this user's linked accounts.",
    plexErrorUnauthorized: 'Unable to connect to Plex using your credentials',
    plexErrorExists: 'This account is already linked to a Plex user',
    errorUnknown: 'An unknown error occurred',
    deleteFailed: 'Unable to delete linked account.',
    trakt: 'Trakt',
    traktConfigure:
      'Ask an administrator to configure Trakt before connecting an account.',
    traktLoadFailed: 'The Trakt connection could not be loaded.',
    traktReconnectRequired: 'Reconnect required',
    traktNotConnected: 'Not connected',
    traktAccount: 'Trakt account',
  }
);

const plexOAuth = new PlexOAuth();

enum LinkedAccountType {
  Plex = 'Plex',
  Jellyfin = 'Jellyfin',
  Emby = 'Emby',
}

type LinkedAccount = {
  type: LinkedAccountType;
  username: string;
};

const UserLinkedAccountsSettings = () => {
  const intl = useIntl();
  const settings = useSettings();
  const router = useRouter();
  const { user: currentUser } = useUser();
  const {
    user,
    hasPermission,
    revalidate: revalidateUser,
  } = useUser({ id: Number(router.query.userId) });
  const { data: passwordInfo } = useSWR<{ hasPassword: boolean }>(
    user ? `/api/v1/user/${user?.id}/settings/password` : null
  );
  const currentUserIsAdmin =
    ((currentUser?.permissions ?? 0) & Permission.ADMIN) === Permission.ADMIN;
  const canManageTrakt =
    !!user && (currentUser?.id === user.id || currentUserIsAdmin);
  const {
    data: traktSettings,
    error: traktError,
    mutate: revalidateTrakt,
  } = useSWR<TraktUserSettingsResponse>(
    canManageTrakt && user ? `/api/v1/user/${user.id}/settings/trakt` : null
  );
  const [showJellyfinModal, setShowJellyfinModal] = useState(false);
  const [showJellyfinQuickConnectModal, setShowJellyfinQuickConnectModal] =
    useState(false);
  const [error, setError] = useState<string | null>(null);

  const applicationName = settings.currentSettings.applicationTitle;

  const accounts: LinkedAccount[] = useMemo(() => {
    const accounts: LinkedAccount[] = [];
    if (!user) return accounts;
    if (user.userType === UserType.PLEX && user.plexUsername)
      accounts.push({
        type: LinkedAccountType.Plex,
        username: user.plexUsername,
      });
    if (user.userType === UserType.EMBY && user.jellyfinUsername)
      accounts.push({
        type: LinkedAccountType.Emby,
        username: user.jellyfinUsername,
      });
    if (user.userType === UserType.JELLYFIN && user.jellyfinUsername)
      accounts.push({
        type: LinkedAccountType.Jellyfin,
        username: user.jellyfinUsername,
      });
    return accounts;
  }, [user]);

  const linkPlexAccount = async () => {
    setError(null);
    try {
      const authToken = await plexOAuth.login(
        settings.currentSettings.plexClientIdentifier
      );
      await axios.post(
        `/api/v1/user/${user?.id}/settings/linked-accounts/plex`,
        {
          authToken,
        }
      );
      await revalidateUser();
    } catch (e) {
      switch (e?.response?.status) {
        case 401:
          setError(intl.formatMessage(messages.plexErrorUnauthorized));
          break;
        case 422:
          setError(intl.formatMessage(messages.plexErrorExists));
          break;
        default:
          setError(intl.formatMessage(messages.errorUnknown));
      }
    }
  };

  const linkable = [
    {
      name: 'Plex',
      action: () => {
        plexOAuth.preparePopup();
        setTimeout(() => linkPlexAccount(), 1500);
      },
      hide:
        settings.currentSettings.mediaServerType !== MediaServerType.PLEX ||
        accounts.some((a) => a.type === LinkedAccountType.Plex),
    },
    {
      name: 'Jellyfin',
      action: () => setShowJellyfinModal(true),
      hide:
        settings.currentSettings.mediaServerType !== MediaServerType.JELLYFIN ||
        accounts.some((a) => a.type === LinkedAccountType.Jellyfin),
    },
    {
      name: 'Emby',
      action: () => setShowJellyfinModal(true),
      hide:
        settings.currentSettings.mediaServerType !== MediaServerType.EMBY ||
        accounts.some((a) => a.type === LinkedAccountType.Emby),
    },
  ].filter((l) => !l.hide);

  const deleteRequest = async (account: string) => {
    try {
      await axios.delete(
        `/api/v1/user/${user?.id}/settings/linked-accounts/${account}`
      );
    } catch {
      setError(intl.formatMessage(messages.deleteFailed));
    }

    await revalidateUser();
  };

  const traktUnconfiguredForUser =
    !!traktSettings &&
    !traktSettings.applicationConfigured &&
    !currentUserIsAdmin;

  const traktRow =
    canManageTrakt && user ? (
      <li
        className="flex items-center gap-4 overflow-hidden rounded-lg bg-gray-800/50 px-4 py-5 shadow ring-1 ring-gray-700 sm:p-6"
        data-testid="profile-trakt-section"
      >
        <div className="w-12">
          <div className="flex aspect-square h-full items-center justify-center rounded-full bg-neutral-800">
            <TraktLogo className="w-9" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-gray-300">
            {intl.formatMessage(messages.trakt)}
          </div>
          {!traktSettings && !traktError ? (
            <LoadingSpinner />
          ) : (
            <>
              <div className="truncate text-xl font-semibold text-white">
                {traktSettings?.connection
                  ? (traktAccountName(traktSettings.connection) ??
                    intl.formatMessage(messages.traktAccount))
                  : intl.formatMessage(messages.traktNotConnected)}
              </div>
              {traktSettings?.connection?.status === 'reconnect_required' && (
                <Badge badgeType="warning">
                  {intl.formatMessage(messages.traktReconnectRequired)}
                </Badge>
              )}
            </>
          )}
        </div>
        <div className="flex-grow" />
        {traktSettings && !traktError && (
          <TraktConnectionActions
            targetUserId={user.id}
            targetUserDisplayName={user.displayName}
            connection={traktSettings.connection}
            applicationConfigured={traktSettings.applicationConfigured}
            showOAuthActions={!traktUnconfiguredForUser}
            onRefresh={revalidateTrakt}
            hideIdentity
          />
        )}
      </li>
    ) : null;

  const traktAlert =
    canManageTrakt && traktError ? (
      <Alert
        title={intl.formatMessage(messages.traktLoadFailed)}
        type="error"
      />
    ) : canManageTrakt && traktUnconfiguredForUser ? (
      <Alert
        title={intl.formatMessage(messages.traktConfigure)}
        type="warning"
      />
    ) : null;

  if (
    currentUser?.id !== user?.id &&
    hasPermission(Permission.ADMIN) &&
    currentUser?.id !== 1
  ) {
    return (
      <>
        <div className="mb-6">
          <h3 className="heading">
            {intl.formatMessage(messages.linkedAccounts)}
          </h3>
        </div>
        <Alert
          title={intl.formatMessage(messages.noPermissionDescription)}
          type="error"
        />
        {traktAlert}
        {traktRow && <ul className="space-y-4">{traktRow}</ul>}
      </>
    );
  }

  const enableMediaServerUnlink = user?.id !== 1 && passwordInfo?.hasPassword;

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.linkedAccounts),
          intl.formatMessage(globalMessages.usersettings),
          user?.displayName,
        ]}
      />
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h3 className="heading">
            {intl.formatMessage(messages.linkedAccounts)}
          </h3>
          <h6 className="description">
            {intl.formatMessage(messages.linkedAccountsHint, {
              applicationName,
            })}
          </h6>
        </div>
        {currentUser?.id === user?.id && !!linkable.length && (
          <div>
            <Dropdown text="Link Account" buttonType="ghost">
              {linkable.map(({ name, action }) => (
                <Dropdown.Item key={name} onClick={action}>
                  {name}
                </Dropdown.Item>
              ))}
            </Dropdown>
          </div>
        )}
      </div>
      {error && <Alert title={error} type="error" />}
      {traktAlert}
      {accounts.length || traktRow ? (
        <ul className="space-y-4">
          {accounts.map((acct, i) => (
            <li
              key={i}
              className="flex items-center gap-4 overflow-hidden rounded-lg bg-gray-800/50 px-4 py-5 shadow ring-1 ring-gray-700 sm:p-6"
            >
              <div className="w-12">
                {acct.type === LinkedAccountType.Plex ? (
                  <div className="flex aspect-square h-full items-center justify-center rounded-full bg-neutral-800">
                    <PlexLogo className="w-9" />
                  </div>
                ) : acct.type === LinkedAccountType.Emby ? (
                  <EmbyLogo />
                ) : (
                  <JellyfinLogo />
                )}
              </div>
              <div>
                <div className="truncate text-sm font-bold text-gray-300">
                  {acct.type}
                </div>
                <div className="text-xl font-semibold text-white">
                  {acct.username}
                </div>
              </div>
              <div className="flex-grow" />
              {enableMediaServerUnlink && (
                <ConfirmButton
                  onClick={() => {
                    deleteRequest(
                      acct.type === LinkedAccountType.Plex ? 'plex' : 'jellyfin'
                    );
                  }}
                  confirmText={intl.formatMessage(globalMessages.areyousure)}
                >
                  <TrashIcon />
                  <span>{intl.formatMessage(globalMessages.delete)}</span>
                </ConfirmButton>
              )}
            </li>
          ))}
          {traktRow}
        </ul>
      ) : (
        <div className="mt-4 text-center md:py-12">
          <h3 className="text-lg font-semibold text-gray-400">
            {intl.formatMessage(messages.noLinkedAccounts)}
          </h3>
        </div>
      )}

      <LinkJellyfinModal
        show={showJellyfinModal}
        onClose={() => setShowJellyfinModal(false)}
        onSave={() => {
          setShowJellyfinModal(false);
          revalidateUser();
        }}
        onSwitchToQuickConnect={() => {
          setShowJellyfinModal(false);
          setShowJellyfinQuickConnectModal(true);
        }}
      />

      <LinkJellyfinQuickConnectModal
        show={showJellyfinQuickConnectModal}
        onClose={() => setShowJellyfinQuickConnectModal(false)}
        onSave={() => {
          setShowJellyfinQuickConnectModal(false);
          revalidateUser();
        }}
        onSwitchToPassword={() => {
          setShowJellyfinQuickConnectModal(false);
          setShowJellyfinModal(true);
        }}
      />
    </>
  );
};

export default UserLinkedAccountsSettings;
