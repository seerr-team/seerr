import EmbyLogo from '@app/assets/services/emby-icon-only.svg';
import JellyfinLogo from '@app/assets/services/jellyfin-icon.svg';
import PlexLogo from '@app/assets/services/plex.svg';
import Alert from '@app/components/Common/Alert';
import ConfirmButton from '@app/components/Common/ConfirmButton';
import Dropdown from '@app/components/Common/Dropdown';
import PageTitle from '@app/components/Common/PageTitle';
import LinkJellyfinQuickConnectModal from '@app/components/UserProfile/UserSettings/UserLinkedAccountsSettings/LinkJellyfinQuickConnectModal';
import useSettings from '@app/hooks/useSettings';
import { Permission, UserType, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import {
  clearOidcProviderSlug,
  getOidcErrorMessage,
  getOidcProviderSlug,
  initiateOidcLogin,
  processOidcCallback,
} from '@app/utils/oidc';
import PlexOAuth from '@app/utils/plex';
import { TrashIcon } from '@heroicons/react/24/solid';
import { MediaServerType } from '@server/constants/server';
import type {
  UserSettingsLinkedAccount,
  UserSettingsLinkedAccountResponse,
} from '@server/interfaces/api/userSettingsInterfaces';
import axios from 'axios';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
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
  }
);

const plexOAuth = new PlexOAuth();

enum LinkedAccountType {
  Plex = 'Plex',
  Jellyfin = 'Jellyfin',
  Emby = 'Emby',
  OpenIdConnect = 'oidc',
}

type LinkedAccount =
  | {
      type:
        | LinkedAccountType.Plex
        | LinkedAccountType.Emby
        | LinkedAccountType.Jellyfin;
      username: string;
    }
  | ({
      type: LinkedAccountType.OpenIdConnect;
    } & UserSettingsLinkedAccount);

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
  const { data: linkedOidcAccounts, mutate: revalidateLinkedAccounts } =
    useSWR<UserSettingsLinkedAccountResponse>(
      user ? `/api/v1/user/${user?.id}/settings/linked-accounts` : null
    );
  const [showJellyfinModal, setShowJellyfinModal] = useState(false);
  const [showJellyfinQuickConnectModal, setShowJellyfinQuickConnectModal] =
    useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle OIDC callback when the provider redirects back to this page
  useEffect(() => {
    if (!router.isReady) return;
    const code = router.query.code;
    const error = router.query.error;
    const providerSlug = getOidcProviderSlug();
    if (
      (typeof code !== 'string' && typeof error !== 'string') ||
      providerSlug == null
    )
      return;
    clearOidcProviderSlug();

    // Strip the OIDC params from the URL immediately
    router.replace(router.pathname, undefined, { shallow: true });

    processOidcCallback(providerSlug).then(async (result) => {
      if (result.type === 'success') {
        await revalidateLinkedAccounts();
      } else {
        const providerName =
          settings.currentSettings.openIdProviders.find(
            (p) => p.slug === providerSlug
          )?.name ?? providerSlug;
        setError(getOidcErrorMessage(result.errorCode, providerName, intl));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  const applicationName = settings.currentSettings.applicationTitle;

  const accounts: LinkedAccount[] = useMemo(() => {
    const accounts: LinkedAccount[] =
      linkedOidcAccounts?.map((a) => ({
        type: LinkedAccountType.OpenIdConnect,
        ...a,
      })) ?? [];
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
  }, [user, linkedOidcAccounts]);

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
    ...settings.currentSettings.openIdProviders.map((p) => ({
      name: p.name,
      action: async () => {
        try {
          await initiateOidcLogin(
            p.slug,
            new URL(window.location.pathname, window.location.origin).toString()
          );
        } catch {
          setError(intl.formatMessage(messages.errorUnknown));
        }
      },
      hide: accounts.some(
        (a) =>
          a.type === LinkedAccountType.OpenIdConnect &&
          a.provider.slug === p.slug
      ),
    })),
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
    await revalidateLinkedAccounts();
  };

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
      </>
    );
  }

  const canUnlink = !!passwordInfo?.hasPassword || accounts.length > 1;
  // primary admin cannot unlink their media server account
  const canUnlinkMediaServer = canUnlink && user?.id !== 1;

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
                <Dropdown.Item key={name} onClick={action} buttonType="ghost">
                  {name}
                </Dropdown.Item>
              ))}
            </Dropdown>
          </div>
        )}
      </div>
      {error && <Alert title={error} type="error" />}
      {accounts.length ? (
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
                ) : acct.type === LinkedAccountType.Jellyfin ? (
                  <JellyfinLogo />
                ) : acct.type === LinkedAccountType.OpenIdConnect ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={acct.provider.logo || '/images/openid.svg'}
                    alt={acct.provider.name}
                  />
                ) : null}
              </div>
              <div>
                <div className="truncate text-sm font-bold text-gray-300">
                  {acct.type === LinkedAccountType.OpenIdConnect
                    ? acct.provider.name
                    : acct.type}
                </div>
                <div className="text-xl font-semibold text-white">
                  {acct.username}
                </div>
              </div>
              <div className="flex-grow" />
              {(acct.type === LinkedAccountType.OpenIdConnect
                ? canUnlink
                : canUnlinkMediaServer) && (
                <ConfirmButton
                  onClick={() => {
                    deleteRequest(
                      acct.type === LinkedAccountType.OpenIdConnect
                        ? String(acct.id)
                        : acct.type === LinkedAccountType.Plex
                          ? 'plex'
                          : 'jellyfin'
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
