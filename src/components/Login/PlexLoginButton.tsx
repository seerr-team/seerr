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
      className="relative flex-1 rounded-lg border border-[#f9a23f]/45 bg-gradient-to-r from-[#f9a23f]/20 to-[#ff7aa2]/15 text-slate-100 shadow-[0_8px_24px_rgba(249,162,63,0.18)] transition hover:border-[#f9a23f]/70 hover:from-[#f9a23f]/35 hover:to-[#ff7aa2]/25 hover:text-white disabled:opacity-50"
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
    </Button>
  );
};

export default PlexLoginButton;
