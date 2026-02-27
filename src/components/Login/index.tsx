import EmbyLogo from '@app/assets/services/emby-icon-only.svg';
import JellyfinLogo from '@app/assets/services/jellyfin-icon.svg';
import PlexLogo from '@app/assets/services/plex.svg';
import Button from '@app/components/Common/Button';
import ImageFader from '@app/components/Common/ImageFader';
import PageTitle from '@app/components/Common/PageTitle';
import LanguagePicker from '@app/components/Layout/LanguagePicker';
import JellyfinLogin from '@app/components/Login/JellyfinLogin';
import LocalLogin from '@app/components/Login/LocalLogin';
import PlexLoginButton from '@app/components/Login/PlexLoginButton';
import PlexPinEntry from '@app/components/Login/PlexPinEntry';
import PlexProfileSelector from '@app/components/Login/PlexProfileSelector';
import useSettings from '@app/hooks/useSettings';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { XCircleIcon } from '@heroicons/react/24/solid';
import type { PlexProfile } from '@server/api/plextv';
import { ApiErrorCode } from '@server/constants/error';
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
  authFailed: 'Authentication failed',
  invalidPin: 'Invalid PIN. Please try again.',
  accessDenied: 'Access denied.',
  profileUserExists:
    'A profile user already exists for this Plex account. Please contact your administrator to resolve this duplicate.',
  couldNotLoadProfiles:
    "We couldn't load your Plex profiles. Please try signing in again.",
});

const Login = () => {
  const intl = useIntl();
  const router = useRouter();
  const settings = useSettings();
  const { user, revalidate } = useUser();

  const [error, setError] = useState('');
  const [isProcessing, setProcessing] = useState(false);
  const [authToken, setAuthToken] = useState<string | undefined>();
  const [mediaServerLogin, setMediaServerLogin] = useState(
    settings.currentSettings.mediaServerLogin
  );
  const profilesRef = useRef<PlexProfile[]>([]);
  const [profiles, setProfiles] = useState<PlexProfile[]>([]);
  const [mainUserId, setMainUserId] = useState<number | null>(null);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [pinProfileId, setPinProfileId] = useState<string | null>(null);
  const [pinProfileName, setPinProfileName] = useState<string | null>(null);
  const [pinProfileThumb, setPinProfileThumb] = useState<string | null>(null);
  const [pinIsProtected, setPinIsProtected] = useState<boolean>(false);
  const [pinIsMainUser, setPinIsMainUser] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Effect that is triggered when the `authToken` comes back from the Plex OAuth
  useEffect(() => {
    const login = async () => {
      setProcessing(true);
      try {
        const response = await axios.post('/api/v1/auth/plex', { authToken });
        switch (response.data?.status) {
          case 'REQUIRES_PIN': {
            setPinProfileId(response.data.profileId);
            setPinProfileName(response.data.profileName);
            setPinProfileThumb(response.data.profileThumb);
            setPinIsProtected(response.data.isProtected);
            setPinIsMainUser(response.data.isMainUser);
            setShowPinEntry(true);
            break;
          }
          case 'REQUIRES_PROFILE': {
            setProfiles(response.data.profiles);
            profilesRef.current = response.data.profiles;
            const rawUserId = response.data.mainUserId;
            const numericUserId = Number(rawUserId);
            if (
              rawUserId == null ||
              Number.isNaN(numericUserId) ||
              numericUserId <= 0
            ) {
              setError(intl.formatMessage(messages.couldNotLoadProfiles));
              break;
            }
            setMainUserId(numericUserId);
            setShowProfileSelector(true);
            break;
          }
          default:
            if (response.data?.id) {
              revalidate();
            }
            break;
        }
      } catch (e) {
        const httpStatus = e?.response?.status;
        const msg =
          httpStatus === 403
            ? intl.formatMessage(messages.accessDenied)
            : (e?.response?.data?.message ??
              intl.formatMessage(messages.authFailed));
        setError(msg);
        setAuthToken(undefined);
      } finally {
        setProcessing(false);
      }
    };
    if (authToken) {
      login();
    }
  }, [authToken, revalidate, intl]);

  const handleSubmitProfile = async (
    profileId: string,
    pin?: string,
    onError?: (msg: string) => void
  ) => {
    setProcessing(true);
    setError('');

    try {
      const payload = {
        profileId,
        mainUserId,
        ...(pin && { pin }),
        ...(authToken && { authToken }),
      };

      const response = await axios.post(
        '/api/v1/auth/plex/profile/select',
        payload
      );

      if (response.data?.status === 'REQUIRES_PIN') {
        setShowPinEntry(true);
        setPinProfileId(profileId);
        setPinProfileName(
          profiles.find((p) => p.id === profileId)?.title ||
            profiles.find((p) => p.id === profileId)?.username ||
            'Profile'
        );
        setPinProfileThumb(
          profiles.find((p) => p.id === profileId)?.thumb || null
        );
        setPinIsProtected(
          profiles.find((p) => p.id === profileId)?.protected || false
        );
        setPinIsMainUser(
          profiles.find((p) => p.id === profileId)?.isMainUser || false
        );
        setPinError(null);
      } else {
        setShowProfileSelector(false);
        setShowPinEntry(false);
        setPinError(null);
        setPinProfileId(null);
        setPinProfileName(null);
        setPinProfileThumb(null);
        setPinIsProtected(false);
        setPinIsMainUser(false);
        revalidate();
      }
    } catch (e) {
      const code = e?.response?.data?.error as string | undefined;
      const httpStatus = e?.response?.status;
      let msg: string;

      switch (code) {
        case ApiErrorCode.NewPlexLoginDisabled:
          msg = intl.formatMessage(messages.accessDenied);
          setPinError(null);
          break;
        case ApiErrorCode.InvalidPin:
          msg = intl.formatMessage(messages.invalidPin);
          setPinError(msg);
          break;
        case ApiErrorCode.ProfileUserExists:
          msg = intl.formatMessage(messages.profileUserExists);
          setPinError(null);
          break;
        default:
          if (httpStatus === 401) {
            msg = intl.formatMessage(messages.invalidPin);
            setPinError(msg);
          } else if (httpStatus === 403) {
            msg = intl.formatMessage(messages.accessDenied);
            setPinError(null);
          } else {
            msg =
              e?.response?.data?.message ??
              intl.formatMessage(messages.authFailed);
            setPinError(null);
          }
      }
      setError(msg);
      if (onError) {
        onError(msg);
      }
    } finally {
      setProcessing(false);
    }
  };

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

  const mediaServerName =
    settings.currentSettings.mediaServerType === MediaServerType.PLEX
      ? 'Plex'
      : settings.currentSettings.mediaServerType === MediaServerType.JELLYFIN
        ? 'Jellyfin'
        : settings.currentSettings.mediaServerType === MediaServerType.EMBY
          ? 'Emby'
          : undefined;

  const MediaServerLogo =
    settings.currentSettings.mediaServerType === MediaServerType.PLEX
      ? PlexLogo
      : settings.currentSettings.mediaServerType === MediaServerType.JELLYFIN
        ? JellyfinLogo
        : settings.currentSettings.mediaServerType === MediaServerType.EMBY
          ? EmbyLogo
          : undefined;

  const isJellyfin =
    settings.currentSettings.mediaServerType === MediaServerType.JELLYFIN ||
    settings.currentSettings.mediaServerType === MediaServerType.EMBY;
  const mediaServerLoginRef = useRef<HTMLDivElement>(null);
  const localLoginRef = useRef<HTMLDivElement>(null);
  const loginRef = mediaServerLogin ? mediaServerLoginRef : localLoginRef;

  const loginFormVisible =
    (isJellyfin && settings.currentSettings.mediaServerLogin) ||
    settings.currentSettings.localLogin;
  const additionalLoginOptions = [
    settings.currentSettings.mediaServerLogin &&
      (settings.currentSettings.mediaServerType === MediaServerType.PLEX ? (
        <PlexLoginButton
          key="plex"
          isProcessing={isProcessing}
          onAuthToken={(authToken) => setAuthToken(authToken)}
          large={!isJellyfin && !settings.currentSettings.localLogin}
        />
      ) : (
        settings.currentSettings.localLogin &&
        (mediaServerLogin ? (
          <Button
            key="seerr"
            data-testid="seerr-login-button"
            className="flex-1 bg-transparent"
            onClick={() => setMediaServerLogin(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/os_icon.svg"
              alt={settings.currentSettings.applicationTitle}
              className="mr-2 h-5"
            />
            <span>{settings.currentSettings.applicationTitle}</span>
          </Button>
        ) : (
          <Button
            key="mediaserver"
            data-testid="mediaserver-login-button"
            className="flex-1 bg-transparent"
            onClick={() => setMediaServerLogin(true)}
          >
            <MediaServerLogo />
            <span>{mediaServerName}</span>
          </Button>
        ))
      )),
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
              {showPinEntry && pinProfileId && pinProfileName ? (
                <PlexPinEntry
                  profileId={pinProfileId}
                  profileName={pinProfileName}
                  profileThumb={pinProfileThumb}
                  isProtected={pinIsProtected}
                  isMainUser={pinIsMainUser}
                  error={pinError}
                  onSubmit={(pin) => {
                    return handleSubmitProfile(pinProfileId, pin);
                  }}
                  onCancel={() => {
                    setShowPinEntry(false);
                    setPinProfileId(null);
                    setPinProfileName(null);
                    setPinProfileThumb(null);
                    setPinIsProtected(false);
                    setPinIsMainUser(false);
                    setPinError(null);
                    setShowProfileSelector(true);
                  }}
                />
              ) : showProfileSelector ? (
                <PlexProfileSelector
                  profiles={profiles}
                  mainUserId={mainUserId || 1}
                  authToken={authToken}
                  onProfileSelected={(profileId, pin, onError) =>
                    handleSubmitProfile(profileId, pin, onError)
                  }
                  onBack={() => {
                    setShowProfileSelector(false);
                    setAuthToken(undefined);
                  }}
                />
              ) : (
                <SwitchTransition mode="out-in">
                  <CSSTransition
                    key={mediaServerLogin ? 'ms' : 'local'}
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
                      appearActive:
                        'transition-opacity duration-500 opacity-100',
                      enter: 'opacity-0',
                      enterActive:
                        'transition-opacity duration-500 opacity-100',
                      exitActive: 'transition-opacity duration-0 opacity-0',
                    }}
                  >
                    <div ref={loginRef} className="button-container">
                      {isJellyfin &&
                      (mediaServerLogin ||
                        !settings.currentSettings.localLogin) ? (
                        <JellyfinLogin
                          serverType={settings.currentSettings.mediaServerType}
                          revalidate={revalidate}
                        />
                      ) : (
                        settings.currentSettings.localLogin && (
                          <LocalLogin revalidate={revalidate} />
                        )
                      )}
                    </div>
                  </CSSTransition>
                </SwitchTransition>
              )}

              {!showProfileSelector &&
                !showPinEntry &&
                additionalLoginOptions.length > 0 &&
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

              {!showProfileSelector && !showPinEntry && (
                <div
                  className={`flex w-full flex-wrap gap-2 ${
                    !loginFormVisible ? 'flex-col' : ''
                  }`}
                >
                  {additionalLoginOptions}
                </div>
              )}
            </div>
          </>
        </div>
      </div>
    </div>
  );
};

export default Login;
