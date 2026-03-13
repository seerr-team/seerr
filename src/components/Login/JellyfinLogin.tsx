import Button from '@app/components/Common/Button';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import useSettings from '@app/hooks/useSettings';
import defineMessages from '@app/utils/defineMessages';
import { ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { ApiErrorCode } from '@server/constants/error';
import { MediaServerType, ServerType } from '@server/constants/server';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import * as Yup from 'yup';

const messages = defineMessages('components.Login', {
  loginwithapp: 'Login with {appName}',
  username: 'Username',
  password: 'Password',
  validationusernamerequired: 'Username required',
  validationpasswordrequired: 'Password required',
  loginerror: 'Something went wrong while trying to sign in.',
  adminerror: 'You must use an admin account to sign in.',
  noadminerror: 'No admin user found on the server.',
  credentialerror: 'The username or password is incorrect.',
  invalidurlerror: 'Unable to connect to {mediaServerName} server.',
  tipUsernameHasTrailingWhitespace: 'The username ends with whitespace',
  signingin: 'Signing In…',
  signin: 'Sign In',
  forgotpassword: 'Forgot Password?',
  server: 'Server',
});

interface JellyfinLoginProps {
  revalidate: () => void;
  serverType?: MediaServerType;
}

const JellyfinLogin: React.FC<JellyfinLoginProps> = ({
  revalidate,
  serverType,
}) => {
  const toasts = useToasts();
  const intl = useIntl();
  const settings = useSettings();
  const jellyfinServers = useMemo(
    () =>
      settings.currentSettings.mediaServers.filter(
        (server) =>
          serverType
            ? server.mediaServerType === serverType
            : server.mediaServerType === MediaServerType.JELLYFIN ||
              server.mediaServerType === MediaServerType.EMBY
      ),
    [serverType, settings.currentSettings.mediaServers]
  );
  const [selectedServerId, setSelectedServerId] = useState(
    jellyfinServers[0]?.id
  );
  const selectedServer =
    jellyfinServers.find((server) => server.id === selectedServerId) ??
    jellyfinServers[0];
  const resolvedServerType =
    selectedServer?.mediaServerType ?? serverType ?? MediaServerType.JELLYFIN;

  const mediaServerFormatValues = {
    mediaServerName:
      resolvedServerType === MediaServerType.JELLYFIN
        ? ServerType.JELLYFIN
        : resolvedServerType === MediaServerType.EMBY
          ? ServerType.EMBY
          : 'Media Server',
  };

  const LoginSchema = Yup.object().shape({
    username: Yup.string().required(
      intl.formatMessage(messages.validationusernamerequired)
    ),
    password: Yup.string(),
  });
  const baseUrl =
    selectedServer?.externalHostname ??
    settings.currentSettings.jellyfinExternalHost;
  const jellyfinForgotPasswordUrl =
    selectedServer?.jellyfinForgotPasswordUrl ??
    settings.currentSettings.jellyfinForgotPasswordUrl;

  return (
    <div>
      <Formik
        initialValues={{
          username: '',
          password: '',
        }}
        validationSchema={LoginSchema}
        validateOnBlur={false}
        onSubmit={async (values) => {
          try {
            await axios.post('/api/v1/auth/jellyfin', {
              username: values.username,
              password: values.password,
              email: values.username,
              serverId: selectedServer?.id,
            });
          } catch (e) {
            let errorMessage = null;
            switch (e?.response?.data?.message) {
              case ApiErrorCode.InvalidUrl:
                errorMessage = messages.invalidurlerror;
                break;
              case ApiErrorCode.InvalidCredentials:
                errorMessage = messages.credentialerror;
                break;
              case ApiErrorCode.NotAdmin:
                errorMessage = messages.adminerror;
                break;
              case ApiErrorCode.NoAdminUser:
                errorMessage = messages.noadminerror;
                break;
              default:
                errorMessage = messages.loginerror;
                break;
            }
            toasts.addToast(
              intl.formatMessage(errorMessage, mediaServerFormatValues),
              {
                autoDismiss: true,
                appearance: 'error',
              }
            );
          } finally {
            revalidate();
          }
        }}
      >
        {({ errors, touched, values, isSubmitting, isValid }) => {
          return (
            <>
              <Form data-form-type="login">
                <div>
                  <h2 className="-mt-1 mb-6 text-center text-lg font-bold text-neutral-200">
                    {intl.formatMessage(messages.loginwithapp, {
                      appName: mediaServerFormatValues.mediaServerName,
                    })}
                  </h2>

                  {jellyfinServers.length > 1 && (
                    <div className="mb-4 mt-1">
                      <div className="form-input-field">
                        <select
                          id="serverId"
                          name="serverId"
                          value={selectedServer?.id}
                          onChange={(event) =>
                            setSelectedServerId(event.target.value)
                          }
                          className="w-full"
                        >
                          {jellyfinServers.map((server) => (
                            <option key={server.id} value={server.id}>
                              {server.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="label-tip pt-2">
                        {intl.formatMessage(messages.server)}
                      </div>
                    </div>
                  )}

                  <div className="mb-4 mt-1">
                    <div className="form-input-field">
                      <Field
                        id="username"
                        name="username"
                        type="text"
                        placeholder={intl.formatMessage(messages.username)}
                        className="!bg-gray-700/80 placeholder:text-gray-400"
                        data-form-type="username"
                      />
                    </div>
                    {touched.username && values.username.match(/\s$/) && (
                      <div className="warning label-tip flex items-center">
                        <ExclamationTriangleIcon className="mr-1 h-4 w-4" />
                        {intl.formatMessage(
                          messages.tipUsernameHasTrailingWhitespace
                        )}
                      </div>
                    )}
                    {errors.username && touched.username && (
                      <div className="error">{errors.username}</div>
                    )}
                  </div>

                  <div className="mb-2 mt-1">
                    <div className="form-input-field">
                      <SensitiveInput
                        as="field"
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder={intl.formatMessage(messages.password)}
                        className="!bg-gray-700/80 placeholder:text-gray-400"
                        data-form-type="password"
                        data-1pignore="false"
                        data-lpignore="false"
                      />
                    </div>
                    <div className="flex">
                      {errors.password && touched.password && (
                        <div className="error">{errors.password}</div>
                      )}
                      <div className="flex-grow" />
                      {baseUrl && (
                        <a
                          href={
                            jellyfinForgotPasswordUrl
                              ? `${jellyfinForgotPasswordUrl}`
                              : `${baseUrl}/web/index.html#!/${
                                  resolvedServerType === MediaServerType.EMBY
                                    ? 'startup/'
                                    : ''
                                }forgotpassword.html`
                          }
                          className="pt-2 text-sm text-indigo-500 hover:text-indigo-400"
                        >
                          {intl.formatMessage(messages.forgotpassword)}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  buttonType="primary"
                  type="submit"
                  disabled={isSubmitting || !isValid}
                  className="mt-2 w-full shadow-sm"
                >
                  <ArrowLeftOnRectangleIcon />
                  <span>
                    {isSubmitting
                      ? intl.formatMessage(messages.signingin)
                      : intl.formatMessage(messages.signin)}
                  </span>
                </Button>
              </Form>
            </>
          );
        }}
      </Formik>
    </div>
  );
};

export default JellyfinLogin;
