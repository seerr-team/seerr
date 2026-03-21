import Button from '@app/components/Common/Button';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import useSettings from '@app/hooks/useSettings';
import defineMessages from '@app/utils/defineMessages';
import { ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';
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
  tipEmailHasTrailingWhitespace: 'The email ends with whitespace',
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
          setLoginError(null);
          await axios.post('/api/v1/auth/local', {
            email: values.email,
            password: values.password,
          });
        } catch {
          setLoginError(intl.formatMessage(messages.loginerror));
        } finally {
          revalidate();
        }
      }}
    >
      {({ errors, touched, values, isSubmitting, isValid }) => {
        return (
          <Form data-form-type="login" className="space-y-4">
            <div>
              <h2 className="-mt-1 mb-6 text-center text-lg font-bold text-slate-100">
                {intl.formatMessage(messages.loginwithapp, {
                  appName: settings.currentSettings.applicationTitle,
                })}
              </h2>

              <div className="mb-4 mt-1">
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
                    className="w-full rounded-lg border border-[#3d4f82] bg-[#1f2b4f]/95 px-3 py-2 text-white placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                  />
                </div>

                {touched.email && values.email.match(/\s$/) && (
                  <div className="label-tip mt-2 flex items-center text-amber-300">
                    <ExclamationTriangleIcon className="mr-1 h-4 w-4" />
                    {intl.formatMessage(messages.tipEmailHasTrailingWhitespace)}
                  </div>
                )}

                {errors.email &&
                  touched.email &&
                  typeof errors.email === 'string' && (
                    <div className="mt-2 text-sm text-red-400">
                      {errors.email}
                    </div>
                  )}
              </div>

              <div className="mb-2 mt-1">
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
                    className="w-full rounded-lg border border-[#3d4f82] bg-[#1f2b4f]/95 px-3 py-2 text-white placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                    data-1pignore="false"
                    data-lpignore="false"
                  />
                </div>

                <div className="flex">
                  {errors.password &&
                    touched.password &&
                    typeof errors.password === 'string' && (
                      <div className="mt-2 text-sm text-red-400">
                        {errors.password}
                      </div>
                    )}
                  <div className="flex-grow" />
                  {passwordResetEnabled && (
                    <Link
                      href="/resetpassword"
                      className="pt-2 text-sm text-cyan-300 transition hover:text-cyan-200"
                    >
                      {intl.formatMessage(messages.forgotpassword)}
                    </Link>
                  )}
                </div>
              </div>

              {loginError && (
                <div className="mb-2 mt-1 sm:col-span-2 sm:mt-0">
                  <div className="rounded-md border border-red-400/40 bg-red-500/15 px-3 py-2 text-sm text-red-200">
                    {loginError}
                  </div>
                </div>
              )}
            </div>

            <Button
              buttonType="primary"
              type="submit"
              disabled={isSubmitting || !isValid}
              data-testid="local-signin-button"
              className="mt-2 w-full border-0 bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-slate-950 shadow-[0_8px_24px_rgba(51,209,255,0.35)] transition hover:brightness-110 disabled:opacity-60"
            >
              <ArrowLeftOnRectangleIcon />
              <span>
                {isSubmitting
                  ? intl.formatMessage(messages.signingin)
                  : intl.formatMessage(messages.signin)}
              </span>
            </Button>
          </Form>
        );
      }}
    </Formik>
  );
};

export default LocalLogin;
