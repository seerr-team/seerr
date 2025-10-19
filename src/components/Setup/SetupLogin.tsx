import Button from '@app/components/Common/Button';
import PlexLoginButton from '@app/components/Login/PlexLoginButton';
import JellyfinSetup from '@app/components/Setup/JellyfinSetup';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { MediaServerType } from '@server/constants/server';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';

const messages = defineMessages('components.Setup', {
  welcome: 'Welcome to Seerr',
  signinMessage: 'Get started by signing in',
  signin: 'Sign in to your account',
  signinWithJellyfin: 'Enter your Jellyfin details',
  signinWithEmby: 'Enter your Emby details',
  signinWithPlex: 'Enter your Plex details',
  back: 'Go back',
});

interface LoginWithMediaServerProps {
  serverType: MediaServerType;
  onCancel: () => void;
  onComplete: () => void;
}

const SetupLogin: React.FC<LoginWithMediaServerProps> = ({
  serverType,
  onCancel,
  onComplete,
}) => {
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  const [mediaServerType, setMediaServerType] = useState<MediaServerType>(
    MediaServerType.NOT_CONFIGURED
  );
  const { user, revalidate } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Effect that is triggered when the `authToken` comes back from the Plex OAuth
  useEffect(() => {
    const login = async () => {
      if (!authToken) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await axios.post('/api/v1/auth/plex', {
          authToken,
          isSetup: true,
        });

        if (response.status >= 200 && response.status < 300) {
          revalidate();
        }
      } catch (err) {
        setError(
          err.response?.data?.message ||
            'Failed to connect to Plex. Please try again.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (authToken && mediaServerType === MediaServerType.PLEX) {
      login();
    }
  }, [authToken, mediaServerType, revalidate]);

  useEffect(() => {
    if (user) {
      onComplete();
    }
  }, [user, onComplete]);

  return (
    <div className="p-4">
      <div className="mb-2 flex justify-center text-xl font-bold">
        <FormattedMessage {...messages.signin} />
      </div>
      <div className="mb-2 flex justify-center pb-6 text-sm">
        {serverType === MediaServerType.JELLYFIN ? (
          <FormattedMessage {...messages.signinWithJellyfin} />
        ) : serverType === MediaServerType.EMBY ? (
          <FormattedMessage {...messages.signinWithEmby} />
        ) : (
          <FormattedMessage {...messages.signinWithPlex} />
        )}
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-600 p-3 text-white">{error}</div>
      )}

      {serverType === MediaServerType.PLEX && (
        <>
          <div className="flex justify-center bg-black/30 px-10 py-8">
            <PlexLoginButton
              isProcessing={isLoading}
              large
              onAuthToken={(token) => {
                setMediaServerType(MediaServerType.PLEX);
                setAuthToken(token);
              }}
            />
          </div>
          <div className="mt-4">
            <Button buttonType="default" onClick={() => onCancel()}>
              <FormattedMessage {...messages.back} />
            </Button>
          </div>
        </>
      )}
      {serverType === MediaServerType.JELLYFIN && (
        <JellyfinSetup
          revalidate={revalidate}
          serverType={serverType}
          onCancel={onCancel}
        />
      )}
      {serverType === MediaServerType.EMBY && (
        <JellyfinSetup
          revalidate={revalidate}
          serverType={serverType}
          onCancel={onCancel}
        />
      )}
    </div>
  );
};

export default SetupLogin;
