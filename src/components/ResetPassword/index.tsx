import Button from '@app/components/Common/Button';
import ImageFader from '@app/components/Common/ImageFader';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import LanguagePicker from '@app/components/Layout/LanguagePicker';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { LifebuoyIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { Form, Formik } from 'formik';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import * as Yup from 'yup';

const messages = defineMessages('components.ResetPassword', {
  passwordreset: 'Password Reset',
  resetpassword: 'Reset your password',
  password: 'Password',
  confirmpassword: 'Confirm Password',
  validationpasswordrequired: 'You must provide a password',
  validationpasswordmatch: 'Passwords must match',
  validationpasswordminchars:
    'Password is too short; should be a minimum of 8 characters',
  gobacklogin: 'Return to Sign-In Page',
  resetpasswordsuccessmessage: 'Password reset successfully!',
});

const ResetPassword = () => {
  const intl = useIntl();
  const router = useRouter();
  const [hasSubmitted, setSubmitted] = useState(false);

  const guid = router.query.guid;

  const ResetSchema = Yup.object().shape({
    password: Yup.string()
      .required(intl.formatMessage(messages.validationpasswordrequired))
      .min(8, intl.formatMessage(messages.validationpasswordminchars)),
    confirmPassword: Yup.string()
      .required(intl.formatMessage(messages.validationpasswordmatch))
      .test(
        'passwords-match',
        intl.formatMessage(messages.validationpasswordmatch),
        function (value) {
          return this.parent.password === value;
        }
      ),
  });

  return (
    <div className="relative flex min-h-screen flex-col bg-gray-900 py-14">
      <ImageFader
        forceOptimize
        backgroundImages={[
          '/images/rotate1.jpg',
          '/images/rotate2.jpg',
          '/images/rotate3.jpg',
          '/images/rotate4.jpg',
          '/images/rotate5.jpg',
          '/images/rotate6.jpg',
        ]}
      />
      <div className="absolute top-4 right-4 z-50">
        <LanguagePicker />
      </div>
      <div className="relative z-40 mt-10 flex flex-col items-center px-4 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="relative h-48 w-full max-w-full">
          <Image src="/logo_stacked.svg" alt="Logo" fill />
        </div>
        <h2 className="mt-12 text-center text-3xl font-extrabold leading-9 text-gray-100">
          {intl.formatMessage(messages.resetpassword)}
        </h2>
      </div>
      <div className="relative z-50 mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div
          className="bg-gray-800 bg-opacity-50 shadow sm:rounded-lg"
          style={{ backdropFilter: 'blur(5px)' }}
        >
          <div className="px-10 py-8">
            {hasSubmitted ? (
              <>
                <p className="text-md text-gray-300">
                  {intl.formatMessage(messages.resetpasswordsuccessmessage)}
                </p>
                <span className="mt-4 flex justify-center rounded-md shadow-sm">
                  <Link href="/login" passHref legacyBehavior>
                    <Button as="a" buttonType="ghost">
                      {intl.formatMessage(messages.gobacklogin)}
                    </Button>
                  </Link>
                </span>
              </>
            ) : (
              <Formik
                initialValues={{
                  confirmPassword: '',
                  password: '',
                }}
                validationSchema={ResetSchema}
                onSubmit={async (values) => {
                  const response = await axios.post(
                    `/api/v1/auth/reset-password/${guid}`,
                    {
                      password: values.password,
                    }
                  );

                  if (response.status === 200) {
                    setSubmitted(true);
                  }
                }}
              >
                {({ errors, touched, isSubmitting, isValid }) => {
                  return (
                    <Form>
                      <div>
                        <label
                          htmlFor="password"
                          className="my-1 block text-sm font-medium leading-5 text-gray-400 sm:mt-px"
                        >
                          {intl.formatMessage(messages.password)}
                        </label>
                        <div className="mt-1 mb-2 sm:col-span-2 sm:mt-0">
                          <div className="form-input-field">
                            <SensitiveInput
                              as="field"
                              id="password"
                              name="password"
                              type="password"
                              autoComplete="new-password"
                              className="form-input-area block w-full min-w-0 flex-1 rounded-md border border-gray-500 bg-gray-700 text-white transition duration-150 ease-in-out sm:text-sm sm:leading-5"
                            />
                          </div>
                          {errors.password &&
                            touched.password &&
                            typeof errors.password === 'string' && (
                              <div className="error">{errors.password}</div>
                            )}
                        </div>
                        <label
                          htmlFor="confirmPassword"
                          className="my-1 block text-sm font-medium leading-5 text-gray-400 sm:mt-px"
                        >
                          {intl.formatMessage(messages.confirmpassword)}
                        </label>
                        <div className="mt-1 mb-2 sm:col-span-2 sm:mt-0">
                          <div className="form-input-field">
                            <SensitiveInput
                              as="field"
                              id="confirmPassword"
                              name="confirmPassword"
                              type="password"
                              autoComplete="new-password"
                              className="form-input-area block w-full min-w-0 flex-1 rounded-md border border-gray-500 bg-gray-700 text-white transition duration-150 ease-in-out sm:text-sm sm:leading-5"
                            />
                          </div>
                          {errors.confirmPassword &&
                            touched.confirmPassword && (
                              <div className="error">
                                {errors.confirmPassword}
                              </div>
                            )}
                        </div>
                      </div>
                      <div className="mt-4 border-t border-gray-700 pt-5">
                        <div className="flex justify-end">
                          <span className="inline-flex rounded-md shadow-sm">
                            <Button
                              buttonType="primary"
                              type="submit"
                              disabled={isSubmitting || !isValid}
                            >
                              <LifebuoyIcon />
                              <span>
                                {isSubmitting
                                  ? intl.formatMessage(globalMessages.saving)
                                  : intl.formatMessage(globalMessages.save)}
                              </span>
                            </Button>
                          </span>
                        </div>
                      </div>
                    </Form>
                  );
                }}
              </Formik>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
