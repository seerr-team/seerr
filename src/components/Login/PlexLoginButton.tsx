import PlexIcon from '@app/assets/services/plex.svg';
import Button from '@app/components/Common/Button';
import { SmallLoadingSpinner } from '@app/components/Common/LoadingSpinner';
import usePlexLogin from '@app/hooks/usePlexLogin';
import defineMessages from '@app/utils/defineMessages';
import { Fragment } from 'react';
import { FormattedMessage } from 'react-intl';

const messages = defineMessages('components.Login', {
  loginwithapp: 'Login with {appName}',
});

interface PlexLoginButtonProps {
  onAuthToken: (authToken: string) => void;
  isProcessing?: boolean;
  onError?: (message: string) => void;
  large?: boolean;
}

const PlexLoginButton = ({
  onAuthToken,
  onError,
  isProcessing,
  large,
}: PlexLoginButtonProps) => {
  const { loading, login } = usePlexLogin({ onAuthToken, onError });

  return (
    <Button
      className="relative flex-1 border-[#cc7b19] bg-[rgba(204,123,25,0.3)] hover:border-[#cc7b19] hover:bg-[rgba(204,123,25,0.7)] disabled:opacity-50"
      onClick={login}
      disabled={loading || isProcessing}
      data-testid="plex-login-button"
    >
      {loading && (
        <div className="absolute right-0 mr-4 h-4 w-4">
          <SmallLoadingSpinner />
        </div>
      )}

      {large ? (
        <FormattedMessage
          {...messages.loginwithapp}
          values={{
            appName: <PlexIcon className="mt-[2px] ml-[0.35em] w-8" />,
          }}
        >
          {(chunks) => (
            <>
              {chunks.map((c, index) =>
                typeof c === 'string' ? (
                  <span key={index}>{c}</span>
                ) : (
                  <Fragment key={index}>{c}</Fragment>
                )
              )}
            </>
          )}
        </FormattedMessage>
      ) : (
        <PlexIcon className="w-8" />
      )}
    </Button>
  );
};

export default PlexLoginButton;
