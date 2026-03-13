import EmbyLogo from '@app/assets/services/emby-icon-only.svg';
import JellyfinLogo from '@app/assets/services/jellyfin-icon.svg';
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
import { XCircleIcon } from '@heroicons/react/24/solid';
import { MediaServerType } from '@server/constants/server';
import axios from 'axios';
import { useRouter } from 'next/dist/client/router';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { CSSTransition, SwitchTransition } from 'react-transition-group';
import useSWR from 'swr';

const messages = defineMessages('components.Login', {
  signin: 'Sign In',
  signinheader: 'Sign in to continue',
  signinwithplex: 'Use your Plex account',
  signinwithjellyfin: 'Use your {mediaServerName} account',
  signinwithoverseerr: 'Use your {applicationTitle} account',
  orsigninwith: 'Or sign in with',
});

type AuthMethod = 'local' | 'jellyfin' | 'emby';

const Login = () => {
  const intl = useIntl();
  const router = useRouter();
  const settings = useSettings();
  const { user, revalidate } = useUser();

  const [error, setError] = useState('');
  const [isProcessing, setProcessing] = useState(false);
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  const plexEnabled =
    settings.currentSettings.plexLogin &&
    settings.currentSettings.mediaServers.some(
      (server) => server.mediaServerType === MediaServerType.PLEX
    );
  const jellyfinEnabled =
    settings.currentSettings.jellyfinLogin &&
    settings.currentSettings.mediaServers.some(
      (server) => server.mediaServerType === MediaServerType.JELLYFIN
    );
  const embyEnabled =
    settings.currentSettings.embyLogin &&
    settings.currentSettings.mediaServers.some(
      (server) => server.mediaServerType === MediaServerType.EMBY
    );
  const formMethods: AuthMethod[] = [];

  if (
    settings.currentSettings.mediaServerType === MediaServerType.JELLYFIN &&
    jellyfinEnabled
  ) {
    formMethods.push('jellyfin');
  } else if (
    settings.currentSettings.mediaServerType === MediaServerType.EMBY &&
    embyEnabled
  ) {
    formMethods.push('emby');
  }

  if (
    jellyfinEnabled &&
    settings.currentSettings.mediaServerType !== MediaServerType.JELLYFIN
  ) {
    formMethods.push('jellyfin');
  }

  if (
    embyEnabled &&
    settings.currentSettings.mediaServerType !== MediaServerType.EMBY
  ) {
    formMethods.push('emby');
  }

  const defaultAuthMethod = settings.currentSettings.localLogin
    ? 'local'
    : formMethods[0];

  const [activeMethod, setActiveMethod] = useState<AuthMethod | undefined>(
    defaultAuthMethod
  );

  // Effect that is triggered when the `authToken` comes back from the Plex OAuth
  // We take the token and attempt to sign in. If we get a success message, we will
  // ask swr to revalidate the user which _should_ come back with a valid user.
  useEffect(() => {
    const login = async () => {
      setProcessing(true);
      try {
        const response = await axios.post('/api/v1/auth/plex', { authToken });

        if (response.data?.id) {
          revalidate();
        }
      } catch (e) {
        setError(e.response?.data?.message ?? e.response?.data?.error ?? '');
        setAuthToken(undefined);
        setProcessing(false);
      }
    };
    if (authToken) {
      login();
    }
  }, [authToken, revalidate]);

  // Effect that is triggered whenever `useUser`'s user changes. If we get a new
  // valid user, we redirect the user to the home page as the login was successful.
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    const methodEnabled =
      activeMethod === 'local'
        ? settings.currentSettings.localLogin
        : activeMethod === 'jellyfin'
          ? jellyfinEnabled
          : activeMethod === 'emby'
            ? embyEnabled
            : false;

    if (!methodEnabled) {
      setActiveMethod(defaultAuthMethod);
    }
  }, [
    activeMethod,
    defaultAuthMethod,
    embyEnabled,
    jellyfinEnabled,
    settings.currentSettings.localLogin,
  ]);

  const { data: backdrops } = useSWR<string[]>('/api/v1/backdrops', {
    refreshInterval: 0,
    refreshWhenHidden: false,
    revalidateOnFocus: false,
  });

  const loginRef = useRef<HTMLDivElement>(null);
  const mediaServerNames = {
    jellyfin: 'Jellyfin',
    emby: 'Emby',
  };

  const renderForm = (method?: AuthMethod) => {
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

  const loginFormVisible = Boolean(activeMethod && renderForm(activeMethod));
  const additionalLoginOptions = [
    plexEnabled && (
      <PlexLoginButton
        key="plex"
        isProcessing={isProcessing}
        onAuthToken={(authToken) => setAuthToken(authToken)}
        large={!loginFormVisible && !settings.currentSettings.localLogin}
      />
    ),
    settings.currentSettings.localLogin && activeMethod !== 'local' && (
      <Button
        key="seerr"
        data-testid="seerr-login-button"
        className="flex-1 bg-transparent"
        onClick={() => setActiveMethod('local')}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/os_icon.svg"
          alt={settings.currentSettings.applicationTitle}
          className="mr-2 h-5"
        />
        <span>{settings.currentSettings.applicationTitle}</span>
      </Button>
    ),
    jellyfinEnabled && activeMethod !== 'jellyfin' && (
      <Button
        key="jellyfin"
        data-testid="mediaserver-login-button"
        className="flex-1 bg-transparent"
        onClick={() => setActiveMethod('jellyfin')}
      >
        <JellyfinLogo />
        <span>{mediaServerNames.jellyfin}</span>
      </Button>
    ),
    embyEnabled && activeMethod !== 'emby' && (
      <Button
        key="emby"
        data-testid="mediaserver-login-button"
        className="flex-1 bg-transparent"
        onClick={() => setActiveMethod('emby')}
      >
        <EmbyLogo />
        <span>{mediaServerNames.emby}</span>
      </Button>
    ),
  ].filter((o): o is JSX.Element => !!o);

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
              <SwitchTransition mode="out-in">
                <CSSTransition
                  key={activeMethod ?? 'none'}
                  nodeRef={loginRef}
                  addEndListener={(done) => {
                    loginRef.current?.addEventListener(
                      'transitionend',
                      done,
                      false
                    );
                  }}
                  onEntered={() => {
                    document
                      .querySelector<HTMLInputElement>('#email, #username')
                      ?.focus();
                  }}
                  classNames={{
                    appear: 'opacity-0',
                    appearActive: 'transition-opacity duration-500 opacity-100',
                    enter: 'opacity-0',
                    enterActive: 'transition-opacity duration-500 opacity-100',
                    exitActive: 'transition-opacity duration-0 opacity-0',
                  }}
                >
                  <div ref={loginRef} className="button-container">
                    {renderForm(activeMethod)}
                  </div>
                </CSSTransition>
              </SwitchTransition>

              {additionalLoginOptions.length > 0 &&
                (loginFormVisible ? (
                  <div className="flex items-center py-5">
                    <div className="flex-grow border-t border-gray-600" />
                    <span className="mx-2 flex-shrink text-sm text-gray-400">
                      {intl.formatMessage(messages.orsigninwith)}
                    </span>
                    <div className="flex-grow border-t border-gray-600" />
                  </div>
                ) : (
                  <h2 className="mb-6 text-center text-lg font-bold text-neutral-200">
                    {intl.formatMessage(messages.signinheader)}
                  </h2>
                ))}

              <div
                className={`flex w-full flex-wrap gap-2 ${
                  !loginFormVisible ? 'flex-col' : ''
                }`}
              >
                {additionalLoginOptions}
              </div>
            </div>
          </>
        </div>
      </div>
    </div>
  );
};

export default Login;
