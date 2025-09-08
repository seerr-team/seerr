import Layout from '@app/components/Layout';
import LoadingBar from '@app/components/LoadingBar';
import PWAHeader from '@app/components/PWAHeader';
import ServiceWorkerSetup from '@app/components/ServiceWorkerSetup';
import StatusChecker from '@app/components/StatusChecker';
import Toast from '@app/components/Toast';
import ToastContainer from '@app/components/ToastContainer';
import { InteractionProvider } from '@app/context/InteractionContext';
import { LanguageContext } from '@app/context/LanguageContext';
import { SettingsProvider } from '@app/context/SettingsContext';
import { UserContext } from '@app/context/UserContext';
import type { User } from '@app/hooks/useUser';
import { Permission, useUser } from '@app/hooks/useUser';
import '@app/styles/globals.css';
import { polyfillIntl } from '@app/utils/polyfillIntl';
import { MediaServerType } from '@server/constants/server';
import type { PublicSettingsResponse } from '@server/interfaces/api/settingsInterfaces';
import type { AvailableLocale } from '@server/types/languages';
import axios from 'axios';
import type { AppInitialProps, AppProps } from 'next/app';
import App from 'next/app';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { IntlProvider } from 'react-intl';
import { ToastProvider } from 'react-toast-notifications';
import { SWRConfig } from 'swr';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadLocaleData = (locale: AvailableLocale): Promise<any> => {
  switch (locale) {
    case 'ar':
      return import('../i18n/locale/ar.json');
    case 'bg':
      return import('../i18n/locale/bg.json');
    case 'ca':
      return import('../i18n/locale/ca.json');
    case 'cs':
      return import('../i18n/locale/cs.json');
    case 'da':
      return import('../i18n/locale/da.json');
    case 'de':
      return import('../i18n/locale/de.json');
    case 'el':
      return import('../i18n/locale/el.json');
    case 'es':
      return import('../i18n/locale/es.json');
    case 'es-MX':
      return import('../i18n/locale/es_MX.json');
    case 'fi':
      return import('../i18n/locale/fi.json');
    case 'fr':
      return import('../i18n/locale/fr.json');
    case 'he':
      return import('../i18n/locale/he.json');
    case 'hi':
      return import('../i18n/locale/hi.json');
    case 'hr':
      return import('../i18n/locale/hr.json');
    case 'hu':
      return import('../i18n/locale/hu.json');
    case 'it':
      return import('../i18n/locale/it.json');
    case 'ja':
      return import('../i18n/locale/ja.json');
    case 'ko':
      return import('../i18n/locale/ko.json');
    case 'lt':
      return import('../i18n/locale/lt.json');
    case 'nb-NO':
      return import('../i18n/locale/nb_NO.json');
    case 'nl':
      return import('../i18n/locale/nl.json');
    case 'pl':
      return import('../i18n/locale/pl.json');
    case 'pt-BR':
      return import('../i18n/locale/pt_BR.json');
    case 'pt-PT':
      return import('../i18n/locale/pt_PT.json');
    case 'ro':
      return import('../i18n/locale/ro.json');
    case 'ru':
      return import('../i18n/locale/ru.json');
    case 'sq':
      return import('../i18n/locale/sq.json');
    case 'sr':
      return import('../i18n/locale/sr.json');
    case 'sv':
      return import('../i18n/locale/sv.json');
    case 'tr':
      return import('../i18n/locale/tr.json');
    case 'uk':
      return import('../i18n/locale/uk.json');
    case 'zh-CN':
      return import('../i18n/locale/zh_Hans.json');
    case 'zh-TW':
      return import('../i18n/locale/zh_Hant.json');
    default:
      return import('../i18n/locale/en.json');
  }
};

// Custom types so we can correctly type our GetInitialProps function
// with our combined user prop
// This is specific to _app.tsx. Other pages will not need to do this!
type NextAppComponentType = typeof App;
type MessagesType = Record<string, string>;

interface ExtendedAppProps extends AppProps {
  user: User;
  messages: MessagesType;
  locale: AvailableLocale;
  currentSettings: PublicSettingsResponse;
}

const CoreApp: Omit<NextAppComponentType, 'origGetInitialProps'> = ({
  Component,
  pageProps,
  router,
  user,
  messages,
  locale,
  currentSettings,
}: ExtendedAppProps) => {
  let component: React.ReactNode;
  const [loadedMessages, setMessages] = useState<MessagesType>(messages);
  const [currentLocale, setLocale] = useState<AvailableLocale>(locale);

  useEffect(() => {
    loadLocaleData(currentLocale).then(setMessages);
  }, [currentLocale]);

  const { hasPermission } = useUser();

  useEffect(() => {
    const requestsCount = async () => {
      const response = await axios.get('/api/v1/request/count');
      return response.data;
    };

    // Cast navigator to a type that includes setAppBadge and clearAppBadge
    // to avoid TypeScript errors while ensuring these methods exist before calling them.
    const newNavigator = navigator as unknown as {
      setAppBadge?: (count: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };

    const handleBadgeUpdate = () => {
      if ('setAppBadge' in newNavigator) {
        if (
          !router.pathname.match(/(login|setup|resetpassword)/) &&
          hasPermission(Permission.ADMIN)
        ) {
          requestsCount().then((data) => {
            if (data.pending > 0) {
              newNavigator.setAppBadge?.(data.pending);
            } else {
              newNavigator.clearAppBadge?.();
            }
          });
        } else {
          newNavigator.clearAppBadge?.();
        }
      }
    };

    handleBadgeUpdate();

    window.addEventListener('focus', handleBadgeUpdate);

    return () => {
      window.removeEventListener('focus', handleBadgeUpdate);
    };
  }, [hasPermission, router.pathname]);

  if (router.pathname.match(/(login|setup|resetpassword)/)) {
    component = <Component {...pageProps} />;
  } else {
    component = (
      <Layout>
        <Component {...pageProps} />
      </Layout>
    );
  }

  return (
    <SWRConfig
      value={{
        fetcher: (url) => axios.get(url).then((res) => res.data),
        fallback: {
          '/api/v1/auth/me': user,
        },
      }}
    >
      <LanguageContext.Provider value={{ locale: currentLocale, setLocale }}>
        <IntlProvider
          locale={currentLocale}
          defaultLocale="en"
          messages={loadedMessages}
        >
          <LoadingBar />
          <SettingsProvider currentSettings={currentSettings}>
            <InteractionProvider>
              <ToastProvider components={{ Toast, ToastContainer }}>
                <Head>
                  <title>{currentSettings.applicationTitle}</title>
                  <meta
                    name="viewport"
                    content="initial-scale=1, viewport-fit=cover, width=device-width"
                  ></meta>
                  <PWAHeader
                    applicationTitle={currentSettings.applicationTitle}
                  />
                </Head>
                <StatusChecker />
                <ServiceWorkerSetup />
                <UserContext initialUser={user}>{component}</UserContext>
              </ToastProvider>
            </InteractionProvider>
          </SettingsProvider>
        </IntlProvider>
      </LanguageContext.Provider>
    </SWRConfig>
  );
};

CoreApp.getInitialProps = async (initialProps) => {
  const { ctx, router } = initialProps;
  let user: User | undefined = undefined;
  let currentSettings: PublicSettingsResponse = {
    initialized: false,
    applicationTitle: '',
    applicationUrl: '',
    hideAvailable: false,
    hideBlacklisted: false,
    movie4kEnabled: false,
    series4kEnabled: false,
    localLogin: true,
    mediaServerLogin: true,
    discoverRegion: '',
    streamingRegion: '',
    originalLanguage: '',
    mediaServerType: MediaServerType.NOT_CONFIGURED,
    partialRequestsEnabled: true,
    enableSpecialEpisodes: false,
    cacheImages: false,
    vapidPublic: '',
    enablePushRegistration: false,
    locale: 'en',
    emailEnabled: false,
    newPlexLogin: true,
    youtubeUrl: '',
  };

  if (ctx.res) {
    // Check if app is initialized and redirect if necessary
    const response = await axios.get<PublicSettingsResponse>(
      `http://${process.env.HOST || 'localhost'}:${
        process.env.PORT || 5055
      }/api/v1/settings/public`
    );

    currentSettings = response.data;

    const initialized = response.data.initialized;

    if (!initialized) {
      if (!router.pathname.match(/(setup|login\/plex)/)) {
        ctx.res.writeHead(307, {
          Location: '/setup',
        });
        ctx.res.end();
      }
    } else {
      try {
        // Attempt to get the user by running a request to the local api
        const response = await axios.get<User>(
          `http://${process.env.HOST || 'localhost'}:${
            process.env.PORT || 5055
          }/api/v1/auth/me`,
          {
            headers:
              ctx.req && ctx.req.headers.cookie
                ? { cookie: ctx.req.headers.cookie }
                : undefined,
          }
        );
        user = response.data;

        if (router.pathname.match(/(setup|login)/)) {
          ctx.res.writeHead(307, {
            Location: '/',
          });
          ctx.res.end();
        }
      } catch (e) {
        // If there is no user, and ctx.res is set (to check if we are on the server side)
        // _AND_ we are not already on the login or setup route, redirect to /login with a 307
        // before anything actually renders
        if (!router.pathname.match(/(login|setup|resetpassword)/)) {
          ctx.res.writeHead(307, {
            Location: '/login',
          });
          ctx.res.end();
        }
      }
    }
  }

  // Run the default getInitialProps for the main nextjs initialProps
  const appInitialProps: AppInitialProps = await App.getInitialProps(
    initialProps
  );

  const locale = user?.settings?.locale
    ? user.settings.locale
    : currentSettings.locale;

  const messages = await loadLocaleData(locale as AvailableLocale);
  await polyfillIntl(locale);

  return { ...appInitialProps, user, messages, locale, currentSettings };
};

export default CoreApp;
