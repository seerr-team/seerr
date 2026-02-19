import PlexIcon from '@app/assets/services/plex.svg';
import usePlexLogin from '@app/hooks/usePlexLogin';
import defineMessages from '@app/utils/defineMessages';
import { Fragment } from 'react';
import { FormattedMessage } from 'react-intl';
import LoginButton from './LoginButton';

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
    <LoginButton
      className="border-[#cc7b19] bg-[rgba(204,123,25,0.3)] hover:border-[#cc7b19] hover:bg-[rgba(204,123,25,0.7)]"
      onClick={login}
      loading={loading || isProcessing}
      data-testid="plex-login-button"
    >
      {large ? (
        <FormattedMessage
          {...messages.loginwithapp}
          values={{
            appName: <PlexIcon className="ml-[0.35em] mt-[2px] w-8" />,
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
    </LoginButton>
  );
};

export default PlexLoginButton;
