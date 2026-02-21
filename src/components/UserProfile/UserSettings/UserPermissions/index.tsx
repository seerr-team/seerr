import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import PermissionEdit from '@app/components/PermissionEdit';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserPermissions',
  {
    toastSettingsSuccess: 'Permissions saved successfully!',
    toastSettingsFailure: 'Something went wrong while saving settings.',
    permissions: 'Permissions',
    unauthorizedDescription: 'You cannot modify your own permissions.',
    contentFiltering: 'Content Filtering',
    maxMovieRating: 'Maximum Movie Rating',
    maxMovieRatingTip:
      'Restrict content to this rating or lower (e.g., PG-13 allows G, PG, PG-13)',
    maxTvRating: 'Maximum TV Rating',
    maxTvRatingTip:
      'Restrict TV content to this rating or lower (e.g., TV-PG allows TV-Y, TV-Y7, TV-G, TV-PG)',
  }
);

const UserPermissions = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const router = useRouter();
  const { user: currentUser } = useUser();
  const { user, revalidate: revalidateUser } = useUser({
    id: Number(router.query.userId),
  });
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<{
    permissions?: number;
    maxMovieRating?: string;
    maxTvRating?: string;
  }>(user ? `/api/v1/user/${user?.id}/settings/permissions` : null);

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <ErrorPage statusCode={500} />;
  }

  if (currentUser?.id !== 1 && currentUser?.id === user?.id) {
    return (
      <>
        <div className="mb-6">
          <h3 className="heading">
            {intl.formatMessage(messages.permissions)}
          </h3>
        </div>
        <Alert
          title={intl.formatMessage(messages.unauthorizedDescription)}
          type="error"
        />
      </>
    );
  }

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.permissions),
          intl.formatMessage(globalMessages.usersettings),
          user?.displayName,
        ]}
      />
      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.permissions)}</h3>
      </div>
      <Formik
        initialValues={{
          currentPermissions: data?.permissions,
          maxMovieRating: data?.maxMovieRating ?? '',
          maxTvRating: data?.maxTvRating ?? '',
        }}
        enableReinitialize
        onSubmit={async (values) => {
          try {
            await axios.post(`/api/v1/user/${user?.id}/settings/permissions`, {
              permissions: values.currentPermissions ?? 0,
              maxMovieRating: values.maxMovieRating || undefined,
              maxTvRating: values.maxTvRating || undefined,
            });

            addToast(intl.formatMessage(messages.toastSettingsSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch (e) {
            addToast(intl.formatMessage(messages.toastSettingsFailure), {
              autoDismiss: true,
              appearance: 'error',
            });
          } finally {
            revalidate();
            revalidateUser();
          }
        }}
      >
        {({ isSubmitting, setFieldValue, values }) => {
          return (
            <Form className="section">
              <div className="max-w-3xl">
                <PermissionEdit
                  actingUser={currentUser}
                  currentUser={user}
                  currentPermission={values.currentPermissions ?? 0}
                  onUpdate={(newPermission) =>
                    setFieldValue('currentPermissions', newPermission)
                  }
                />
              </div>
              <div className="mt-8 mb-6">
                <h3 className="heading">
                  {intl.formatMessage(messages.contentFiltering)}
                </h3>
              </div>
              <div className="section">
                <div className="form-row">
                  <label htmlFor="maxMovieRating" className="text-label">
                    <span>{intl.formatMessage(messages.maxMovieRating)}</span>
                    <span className="label-tip">
                      {intl.formatMessage(messages.maxMovieRatingTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        as="select"
                        id="maxMovieRating"
                        name="maxMovieRating"
                      >
                        <option value="">No Restriction</option>
                        <option value="G">G - General Audiences</option>
                        <option value="PG">PG - Parental Guidance</option>
                        <option value="PG-13">
                          PG-13 - Parents Strongly Cautioned
                        </option>
                        <option value="R">R - Restricted</option>
                        <option value="NC-17">NC-17 - Adults Only</option>
                        <option value="NR">NR - Allow Unrated</option>
                      </Field>
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="maxTvRating" className="text-label">
                    <span>{intl.formatMessage(messages.maxTvRating)}</span>
                    <span className="label-tip">
                      {intl.formatMessage(messages.maxTvRatingTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field as="select" id="maxTvRating" name="maxTvRating">
                        <option value="">No Restriction</option>
                        <option value="TV-Y">TV-Y - All Children</option>
                        <option value="TV-Y7">TV-Y7 - Children 7+</option>
                        <option value="TV-G">TV-G - General Audiences</option>
                        <option value="TV-PG">TV-PG - Parental Guidance</option>
                        <option value="TV-14">
                          TV-14 - Parents Strongly Cautioned
                        </option>
                        <option value="TV-MA">TV-MA - Mature Audiences</option>
                        <option value="NR">NR - Allow Unrated</option>
                      </Field>
                    </div>
                  </div>
                </div>
              </div>
              <div className="actions">
                <div className="flex justify-end">
                  <span className="ml-3 inline-flex rounded-md shadow-sm">
                    <Button
                      buttonType="primary"
                      type="submit"
                      disabled={isSubmitting}
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

export default UserPermissions;
