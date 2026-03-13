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
import { XCircleIcon } from '@heroicons/react/24/solid';
import { MediaServerType } from '@server/constants/server';
import axios from 'axios';
import { useRouter } from 'next/dist/client/router';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

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

  const { enabledAuthMethods, primaryMediaServer, localLogin } =
    settings.currentSettings;

  const plexEnabled = enabledAuthMethods.includes(MediaServerType.PLEX);
  const jellyfinEnabled = enabledAuthMethods.includes(MediaServerType.JELLYFIN);
  const embyEnabled = enabledAuthMethods.includes(MediaServerType.EMBY);

  // Sort auth methods: primary first, then secondary
  const authSections: JSX.Element[] = [];

  const addPlexSection = () => {
    authSections.push(
      <PlexLoginButton
        key="plex"
        isProcessing={isProcessing}
        onAuthToken={(token) => setAuthToken(token)}
        large={authSections.length === 0 && !localLogin}
      />
    );
  };

  const addJellyfinSection = (serverType: number) => {
    authSections.push(
      <JellyfinLogin
        key={`jellyfin-${serverType}`}
        serverType={serverType}
        revalidate={revalidate}
      />
    );
  };

  // Add primary server's auth first
  if (primaryMediaServer === MediaServerType.PLEX && plexEnabled) {
    addPlexSection();
  } else if (
    primaryMediaServer === MediaServerType.JELLYFIN &&
    jellyfinEnabled
  ) {
    addJellyfinSection(MediaServerType.JELLYFIN);
  } else if (primaryMediaServer === MediaServerType.EMBY && embyEnabled) {
    addJellyfinSection(MediaServerType.EMBY);
  }

  // Add secondary server auth methods
  if (plexEnabled && primaryMediaServer !== MediaServerType.PLEX) {
    addPlexSection();
  }
  if (jellyfinEnabled && primaryMediaServer !== MediaServerType.JELLYFIN) {
    addJellyfinSection(MediaServerType.JELLYFIN);
  }
  if (embyEnabled && primaryMediaServer !== MediaServerType.EMBY) {
    addJellyfinSection(MediaServerType.EMBY);
  }

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

  const hasAnyAuth = authSections.length > 0 || localLogin;

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

              {/* Render all enabled auth methods stacked vertically */}
              <div className="flex flex-col gap-4">
                {authSections.map((section, index) => (
                  <div key={index}>
                    {index > 0 && (
                      <div className="mb-4 flex items-center">
                        <div className="flex-grow border-t border-gray-600" />
                        <span className="mx-2 flex-shrink text-sm text-gray-400">
                          {intl.formatMessage(messages.orsigninwith)}
                        </span>
                        <div className="flex-grow border-t border-gray-600" />
                      </div>
                    )}
                    {section}
                  </div>
                ))}

                {/* Local login at the bottom */}
                {localLogin && (
                  <div>
                    {authSections.length > 0 && (
                      <div className="mb-4 flex items-center">
                        <div className="flex-grow border-t border-gray-600" />
                        <span className="mx-2 flex-shrink text-sm text-gray-400">
                          {intl.formatMessage(messages.orsigninwith)}
                        </span>
                        <div className="flex-grow border-t border-gray-600" />
                      </div>
                    )}
                    <LocalLogin revalidate={revalidate} />
                  </div>
                )}
              </div>
            </div>
          </>
        </div>
      </div>
    </div>
  );
};

export default Login;
