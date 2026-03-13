import EmbyIcon from '@app/assets/services/emby-icon-only.svg';
import JellyfinIcon from '@app/assets/services/jellyfin-icon.svg';
import Button from '@app/components/Common/Button';
import ImageFader from '@app/components/Common/ImageFader';
import PageTitle from '@app/components/Common/PageTitle';
import LanguagePicker from '@app/components/Layout/LanguagePicker';
import JellyfinLogin from '@app/components/Login/JellyfinLogin';
import LocalLogin from '@app/components/Login/LocalLogin';
import PlexLoginButton from '@app/components/Login/PlexLoginButton';
import useSettings from '@app/hooks/useSettings';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { UserIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { MediaServerType, ServerType } from '@server/constants/server';
import axios from 'axios';
import { useRouter } from 'next/dist/client/router';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

type AuthMethod = 'local' | 'plex' | 'jellyfin' | 'emby';

const messages = defineMessages('components.Login', {
  signin: 'Sign In',
  signinheader: 'Sign in to continue',
  signinwithplex: 'Use your Plex account',
  signinwithjellyfin: 'Use your {mediaServerName} account',
  signinwithoverseerr: 'Use your {applicationTitle} account',
  orsigninwith: 'Or sign in with',
});

const Login = () => {
  const intl = useIntl();
  const router = useRouter();
  const settings = useSettings();
  const { user, revalidate } = useUser();

  const [error, setError] = useState('');
  const [isProcessing, setProcessing] = useState(false);
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);

  const {
    enabledAuthMethods,
    primaryMediaServer,
    localLogin,
    applicationTitle,
  } = settings.currentSettings;

  const plexEnabled = enabledAuthMethods.includes(MediaServerType.PLEX);
  const jellyfinEnabled = enabledAuthMethods.includes(MediaServerType.JELLYFIN);
  const embyEnabled = enabledAuthMethods.includes(MediaServerType.EMBY);

  // Build ordered list of available auth methods (primary first)
  const availableMethods: AuthMethod[] = [];

  // Add primary server's auth first
  if (primaryMediaServer === MediaServerType.PLEX && plexEnabled)
    availableMethods.push('plex');
  else if (primaryMediaServer === MediaServerType.JELLYFIN && jellyfinEnabled)
    availableMethods.push('jellyfin');
  else if (primaryMediaServer === MediaServerType.EMBY && embyEnabled)
    availableMethods.push('emby');

  // Add secondary server auth methods
  if (plexEnabled && primaryMediaServer !== MediaServerType.PLEX)
    availableMethods.push('plex');
  if (jellyfinEnabled && primaryMediaServer !== MediaServerType.JELLYFIN)
    availableMethods.push('jellyfin');
  if (embyEnabled && primaryMediaServer !== MediaServerType.EMBY)
    availableMethods.push('emby');

  // Determine the default expanded method:
  // local login if enabled, otherwise the first form-based method
  const defaultMethod: AuthMethod = localLogin
    ? 'local'
    : (availableMethods.find((m) => m !== 'plex') ?? availableMethods[0]);

  const [activeMethod, setActiveMethod] = useState<AuthMethod>(defaultMethod);

  // Plex is always a button (no form), so it's never the "active" expanded form
  const formMethods = availableMethods.filter((m) => m !== 'plex');

  const getMethodButton = (method: AuthMethod) => {
    switch (method) {
      case 'jellyfin':
        return {
          label: ServerType.JELLYFIN,
          icon: <JellyfinIcon className="mr-2 h-5 w-5" />,
          className:
            'border-[#6b4fa0] bg-[rgba(107,79,160,0.3)] hover:border-[#6b4fa0] hover:bg-[rgba(107,79,160,0.5)]',
        };
      case 'emby':
        return {
          label: ServerType.EMBY,
          icon: <EmbyIcon className="mr-2 h-5 w-5" />,
          className:
            'border-[#4caf50] bg-[rgba(76,175,80,0.3)] hover:border-[#4caf50] hover:bg-[rgba(76,175,80,0.5)]',
        };
      case 'local':
        return {
          label: applicationTitle,
          icon: <UserIcon className="mr-2 h-5 w-5" />,
          className:
            'border-gray-600 bg-gray-700/50 hover:border-gray-500 hover:bg-gray-600/50',
        };
      default:
        return { label: '', icon: null, className: '' };
    }
  };

  // Effect that is triggered when the `authToken` comes back from the Plex OAuth
  useEffect(() => {
    const login = async () => {
      setProcessing(true);
      try {
        const response = await axios.post('/api/v1/auth/plex', { authToken });

        if (response.data?.id) {
          revalidate();
        }
      } catch (e) {
        setError(e.response?.data?.message);
        setAuthToken(undefined);
        setProcessing(false);
      }
    };
    if (authToken) {
      login();
    }
  }, [authToken, revalidate]);

  // Redirect on successful login
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const { data: backdrops } = useSWR<string[]>('/api/v1/backdrops', {
    refreshInterval: 0,
    refreshWhenHidden: false,
    revalidateOnFocus: false,
  });

  const hasAnyAuth = availableMethods.length > 0 || localLogin;

  // Render the expanded form for a given method
  const renderForm = (method: AuthMethod) => {
    switch (method) {
      case 'local':
        return <LocalLogin revalidate={revalidate} />;
      case 'jellyfin':
        return (
          <JellyfinLogin
            serverType={MediaServerType.JELLYFIN}
            revalidate={revalidate}
          />
        );
      case 'emby':
        return (
          <JellyfinLogin
            serverType={MediaServerType.EMBY}
            revalidate={revalidate}
          />
        );
      default:
        return null;
    }
  };

  // Collect collapsed (non-active) form methods as buttons
  const collapsedMethods: AuthMethod[] = [];
  if (localLogin && activeMethod !== 'local') collapsedMethods.push('local');
  for (const method of formMethods) {
    if (method !== activeMethod) collapsedMethods.push(method);
  }

  const Divider = () => (
    <div className="flex items-center">
      <div className="flex-grow border-t border-gray-600" />
      <span className="mx-2 flex-shrink text-sm text-gray-400">
        {intl.formatMessage(messages.orsigninwith)}
      </span>
      <div className="flex-grow border-t border-gray-600" />
    </div>
  );

  return (
    <div className="relative flex min-h-screen flex-col bg-gray-900 py-14">
      <PageTitle title={intl.formatMessage(messages.signin)} />
      <ImageFader
        backgroundImages={
          backdrops?.map(
            (backdrop) => `https://image.tmdb.org/t/p/original${backdrop}`
          ) ?? []
        }
      />
      <div className="absolute right-4 top-4 z-50">
        <LanguagePicker />
      </div>
      <div className="relative z-40 mt-10 flex flex-col items-center px-4 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="relative h-48 w-full max-w-full">
          <Image src="/logo_stacked.svg" alt="Logo" fill />
        </div>
      </div>
      <div className="relative z-50 mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div
          className="bg-gray-800/50 shadow sm:rounded-lg"
          style={{ backdropFilter: 'blur(5px)' }}
        >
          <>
            <Transition
              as="div"
              show={!!error}
              enter="transition-opacity duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="mb-4 rounded-md bg-red-600 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <XCircleIcon className="h-5 w-5 text-red-300" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-300">
                      {error}
                    </h3>
                  </div>
                </div>
              </div>
            </Transition>
            <div className="px-10 py-8">
              {!hasAnyAuth && (
                <h2 className="mb-6 text-center text-lg font-bold text-neutral-200">
                  {intl.formatMessage(messages.signinheader)}
                </h2>
              )}

              <div className="flex flex-col gap-4">
                {/* Active expanded form */}
                {activeMethod && renderForm(activeMethod)}

                {/* Plex button shown directly when it's the only method */}
                {plexEnabled && !localLogin && formMethods.length === 0 && (
                  <PlexLoginButton
                    isProcessing={isProcessing}
                    onAuthToken={(token) => setAuthToken(token)}
                    large
                  />
                )}

                {/* "Or sign in with" section for alternative methods */}
                {(plexEnabled && (localLogin || formMethods.length > 0)) ||
                collapsedMethods.length > 0 ? (
                  <>
                    <Divider />
                    <div className="flex flex-col gap-2">
                      {/* Plex is always a button */}
                      {plexEnabled &&
                        (localLogin || formMethods.length > 0) && (
                          <PlexLoginButton
                            isProcessing={isProcessing}
                            onAuthToken={(token) => setAuthToken(token)}
                          />
                        )}

                      {/* Collapsed form methods as branded buttons */}
                      {collapsedMethods.map((method) => {
                        const { label, icon, className } =
                          getMethodButton(method);
                        return (
                          <Button
                            key={method}
                            className={`w-full text-gray-200 ${className}`}
                            onClick={() => setActiveMethod(method)}
                          >
                            {icon}
                            {label}
                          </Button>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </>
        </div>
      </div>
    </div>
  );
};

export default Login;
