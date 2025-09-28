import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { Form, Formik } from 'formik';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserPasswordChange',
  {
    password: 'Password',
    currentpassword: 'Current Password',
    newpassword: 'New Password',
    confirmpassword: 'Confirm Password',
    toastSettingsSuccess: 'Password saved successfully!',
    toastSettingsFailure: 'Something went wrong while saving the password.',
    toastSettingsFailureVerifyCurrent:
      'Something went wrong while saving the password. Was your current password entered correctly?',
    validationCurrentPassword: 'You must provide your current password',
    validationNewPassword: 'You must provide a new password',
    validationNewPasswordLength:
      'Password is too short; should be a minimum of 8 characters',
    validationConfirmPassword: 'You must confirm the new password',
    validationConfirmPasswordSame: 'Passwords must match',
    noPasswordSet:
      'This user account currently does not have a password set. Configure a password below to enable this account to sign in as a "local user."',
    noPasswordSetOwnAccount:
      'Your account currently does not have a password set. Configure a password below to enable sign-in as a "local user" using your email address.',
    nopermissionDescription:
      "You do not have permission to modify this user's password.",
  }
);

const UserPasswordChange = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const router = useRouter();
  const { user: currentUser } = useUser();
  const { user, hasPermission } = useUser({ id: Number(router.query.userId) });
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<{ hasPassword: boolean }>(
    user ? `/api/v1/user/${user?.id}/settings/password` : null
  );

  const PasswordChangeSchema = Yup.object().shape({
    currentPassword: Yup.lazy(() =>
      data?.hasPassword && currentUser?.id === user?.id
        ? Yup.string().required(
            intl.formatMessage(messages.validationCurrentPassword)
          )
        : Yup.mixed().optional()
    ),
    newPassword: Yup.string()
      .required(intl.formatMessage(messages.validationNewPassword))
      .min(8, intl.formatMessage(messages.validationNewPasswordLength)),
    confirmPassword: Yup.string()
      .required(intl.formatMessage(messages.validationConfirmPassword))
      .oneOf(
        [Yup.ref('newPassword'), null],
        intl.formatMessage(messages.validationConfirmPasswordSame)
      ),
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <ErrorPage statusCode={500} />;
  }

  if (
    currentUser?.id !== user?.id &&
    hasPermission(Permission.ADMIN) &&
    currentUser?.id !== 1
  ) {
    return (
      <>
        <div className="mb-6">
          <h3 className="heading">{intl.formatMessage(messages.password)}</h3>
        </div>
        <Alert
          title={intl.formatMessage(messages.nopermissionDescription)}
          type="error"
        />
      </>
    );
  }

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.password),
          intl.formatMessage(globalMessages.usersettings),
          user?.displayName,
        ]}
      />
      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.password)}</h3>
      </div>
      <Formik
        initialValues={{
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }}
        validationSchema={PasswordChangeSchema}
        enableReinitialize
        onSubmit={async (values, { resetForm }) => {
          try {
            await axios.post(`/api/v1/user/${user?.id}/settings/password`, {
              currentPassword: values.currentPassword,
              newPassword: values.newPassword,
              confirmPassword: values.confirmPassword,
            });

            addToast(intl.formatMessage(messages.toastSettingsSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch (e) {
            addToast(
              intl.formatMessage(
                data.hasPassword && user?.id === currentUser?.id
                  ? messages.toastSettingsFailureVerifyCurrent
                  : messages.toastSettingsFailure
              ),
              {
                autoDismiss: true,
                appearance: 'error',
              }
            );
          } finally {
            revalidate();
            resetForm();
          }
        }}
      >
        {({ errors, touched, isSubmitting, isValid }) => {
          return (
            <Form className="section">
              {!data.hasPassword && (
                <Alert
                  type="warning"
                  title={intl.formatMessage(
                    user?.id === currentUser?.id
                      ? messages.noPasswordSetOwnAccount
                      : messages.noPasswordSet
                  )}
                />
              )}
              {data.hasPassword && user?.id === currentUser?.id && (
                <div className="form-row pb-6">
                  <label htmlFor="currentPassword" className="text-label">
                    {intl.formatMessage(messages.currentpassword)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <SensitiveInput
                        as="field"
                        id="currentPassword"
                        name="currentPassword"
                        type="password"
                        autoComplete="current-password"
                      />
                    </div>
                    {errors.currentPassword &&
                      touched.currentPassword &&
                      typeof errors.currentPassword === 'string' && (
                        <div className="error">{errors.currentPassword}</div>
                      )}
                  </div>
                </div>
              )}
              <div className="form-row">
                <label htmlFor="newPassword" className="text-label">
                  {intl.formatMessage(messages.newpassword)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <SensitiveInput
                      as="field"
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                    />
                  </div>
                  {errors.newPassword &&
                    touched.newPassword &&
                    typeof errors.newPassword === 'string' && (
                      <div className="error">{errors.newPassword}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="confirmPassword" className="text-label">
                  {intl.formatMessage(messages.confirmpassword)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <SensitiveInput
                      as="field"
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                    />
                  </div>
                  {errors.confirmPassword &&
                    touched.confirmPassword &&
                    typeof errors.confirmPassword === 'string' && (
                      <div className="error">{errors.confirmPassword}</div>
                    )}
                </div>
              </div>
              <div className="actions">
                <div className="flex justify-end">
                  <span className="ml-3 inline-flex rounded-md shadow-sm">
                    <Button
                      buttonType="primary"
                      type="submit"
                      disabled={isSubmitting || !isValid}
                    >
                      <ArrowDownOnSquareIcon />
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
    </>
  );
};

export default UserPasswordChange;
