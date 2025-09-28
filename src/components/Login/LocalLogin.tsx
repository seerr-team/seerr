import Button from '@app/components/Common/Button';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import useSettings from '@app/hooks/useSettings';
import defineMessages from '@app/utils/defineMessages';
import { ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import Link from 'next/link';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import * as Yup from 'yup';

const messages = defineMessages('components.Login', {
  loginwithapp: 'Login with {appName}',
  username: 'Username',
  email: 'Email Address',
  password: 'Password',
  validationemailrequired: 'You must provide a valid email address',
  validationpasswordrequired: 'You must provide a password',
  loginerror: 'Something went wrong while trying to sign in.',
  signingin: 'Signing In…',
  signin: 'Sign In',
  forgotpassword: 'Forgot Password?',
});

interface LocalLoginProps {
  revalidate: () => void;
}

const LocalLogin = ({ revalidate }: LocalLoginProps) => {
  const intl = useIntl();
  const settings = useSettings();
  const [loginError, setLoginError] = useState<string | null>(null);

  const LoginSchema = Yup.object().shape({
    email: Yup.string().required(
      intl.formatMessage(messages.validationemailrequired)
    ),
    password: Yup.string().required(
      intl.formatMessage(messages.validationpasswordrequired)
    ),
  });

  const passwordResetEnabled =
    settings.currentSettings.applicationUrl &&
    settings.currentSettings.emailEnabled;

  return (
    <Formik
      initialValues={{
        email: '',
        password: '',
      }}
      validationSchema={LoginSchema}
      validateOnBlur={false}
      onSubmit={async (values) => {
        try {
          await axios.post('/api/v1/auth/local', {
            email: values.email,
            password: values.password,
          });
        } catch (e) {
          setLoginError(intl.formatMessage(messages.loginerror));
        } finally {
          revalidate();
        }
      }}
    >
      {({ errors, touched, isSubmitting, isValid }) => {
        return (
          <>
            <Form data-form-type="login">
              <div>
                <h2 className="mb-6 -mt-1 text-center text-lg font-bold text-neutral-200">
                  {intl.formatMessage(messages.loginwithapp, {
                    appName: settings.currentSettings.applicationTitle,
                  })}
                </h2>

                <div className="mt-1 mb-4">
                  <div className="form-input-field">
                    <Field
                      id="email"
                      name="email"
                      placeholder={`${intl.formatMessage(
                        messages.email
                      )} / ${intl.formatMessage(messages.username)}`}
                      type="text"
                      inputMode="email"
                      data-testid="email"
                      data-form-type="username,email"
                      className="!bg-gray-700/80 placeholder:text-gray-400"
                    />
                  </div>
                  {errors.email &&
                    touched.email &&
                    typeof errors.email === 'string' && (
                      <div className="error">{errors.email}</div>
                    )}
                </div>
                <div className="mt-1 mb-2">
                  <div className="form-input-field">
                    <SensitiveInput
                      as="field"
                      id="password"
                      name="password"
                      type="password"
                      placeholder={intl.formatMessage(messages.password)}
                      autoComplete="current-password"
                      data-testid="password"
                      data-form-type="password"
                      className="!bg-gray-700/80 placeholder:text-gray-400"
                      data-1pignore="false"
                      data-lpignore="false"
                    />
                  </div>
                  <div className="flex">
                    {errors.password &&
                      touched.password &&
                      typeof errors.password === 'string' && (
                        <div className="error">{errors.password}</div>
                      )}
                    <div className="flex-grow"></div>
                    {passwordResetEnabled && (
                      <Link
                        href="/resetpassword"
                        className="pt-2 text-sm text-indigo-500 hover:text-indigo-400"
                      >
                        {intl.formatMessage(messages.forgotpassword)}
                      </Link>
                    )}
                  </div>
                </div>
                {loginError && (
                  <div className="mt-1 mb-2 sm:col-span-2 sm:mt-0">
                    <div className="error">{loginError}</div>
                  </div>
                )}
              </div>

              <Button
                buttonType="primary"
                type="submit"
                disabled={isSubmitting || !isValid}
                data-testid="local-signin-button"
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
  );
};

export default LocalLogin;
