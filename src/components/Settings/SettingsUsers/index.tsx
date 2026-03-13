import Button from '@app/components/Common/Button';
import LabeledCheckbox from '@app/components/Common/LabeledCheckbox';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import PermissionEdit from '@app/components/PermissionEdit';
import QuotaSelector from '@app/components/QuotaSelector';
import useSettings from '@app/hooks/useSettings';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import { MediaServerType } from '@server/constants/server';
import type { MainSettings } from '@server/lib/settings';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR, { mutate } from 'swr';
import * as yup from 'yup';

const messages = defineMessages('components.Settings.SettingsUsers', {
  users: 'Users',
  userSettings: 'User Settings',
  userSettingsDescription: 'Configure global and default user settings.',
  toastSettingsSuccess: 'User settings saved successfully!',
  toastSettingsFailure: 'Something went wrong while saving settings.',
  loginMethods: 'Login Methods',
  loginMethodsTip: 'Configure login methods for users.',
  localLogin: 'Enable Local Sign-In',
  localLoginTip:
    'Allow users to sign in using their email address and password',
  plexLogin: 'Enable Plex Sign-In',
  plexLoginTip: 'Allow users to sign in using their Plex account',
  jellyfinLogin: 'Enable {mediaServerName} Sign-In',
  jellyfinLoginTip:
    'Allow users to sign in using their {mediaServerName} account',
  atLeastOneAuth: 'At least one authentication method must be selected.',
  newUserLogin: 'Enable New User Sign-In',
  newUserLoginTip: 'Allow users to sign in without first being imported',
  movieRequestLimitLabel: 'Global Movie Request Limit',
  tvRequestLimitLabel: 'Global Series Request Limit',
  defaultPermissions: 'Default Permissions',
  defaultPermissionsTip: 'Initial permissions assigned to new users',
});

const SettingsUsers = () => {
  const { addToast } = useToasts();
  const intl = useIntl();
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<MainSettings>('/api/v1/settings/main');
  const settings = useSettings();

  const { primaryMediaServer, enabledAuthMethods: currentAuthMethods } =
    settings.currentSettings;

  const plexConfigured =
    primaryMediaServer === MediaServerType.PLEX ||
    currentAuthMethods.includes(MediaServerType.PLEX) ||
    !!settings.currentSettings.plexServerName;
  const jellyfinConfigured =
    primaryMediaServer === MediaServerType.JELLYFIN ||
    currentAuthMethods.includes(MediaServerType.JELLYFIN);
  const embyConfigured =
    primaryMediaServer === MediaServerType.EMBY ||
    currentAuthMethods.includes(MediaServerType.EMBY);

  const schema = yup
    .object()
    .shape({
      localLogin: yup.boolean(),
      plexEnabled: yup.boolean(),
      jellyfinEnabled: yup.boolean(),
      embyEnabled: yup.boolean(),
    })
    .test({
      name: 'atLeastOneAuth',
      test: function (values) {
        const isValid =
          values.localLogin ||
          values.plexEnabled ||
          values.jellyfinEnabled ||
          values.embyEnabled;

        if (isValid) return true;
        return this.createError({
          path: 'localLogin',
          message: intl.formatMessage(messages.atLeastOneAuth),
        });
      },
    });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  const enabledAuthMethods = data?.enabledAuthMethods ?? [];

  const jellyfinMediaServerName =
    primaryMediaServer === MediaServerType.EMBY || embyConfigured
      ? 'Emby'
      : 'Jellyfin';

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.users),
          intl.formatMessage(globalMessages.settings),
        ]}
      />
      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.userSettings)}</h3>
        <p className="description">
          {intl.formatMessage(messages.userSettingsDescription)}
        </p>
      </div>
      <div className="section">
        <Formik
          initialValues={{
            localLogin: data?.localLogin,
            plexEnabled: enabledAuthMethods.includes(MediaServerType.PLEX),
            jellyfinEnabled: enabledAuthMethods.includes(
              MediaServerType.JELLYFIN
            ),
            embyEnabled: enabledAuthMethods.includes(MediaServerType.EMBY),
            newUserLogin: data?.newUserLogin,
            movieQuotaLimit: data?.defaultQuotas.movie.quotaLimit ?? 0,
            movieQuotaDays: data?.defaultQuotas.movie.quotaDays ?? 7,
            tvQuotaLimit: data?.defaultQuotas.tv.quotaLimit ?? 0,
            tvQuotaDays: data?.defaultQuotas.tv.quotaDays ?? 7,
            defaultPermissions: data?.defaultPermissions ?? 0,
          }}
          validationSchema={schema}
          enableReinitialize
          onSubmit={async (values) => {
            try {
              const newEnabledAuthMethods: number[] = [];
              if (values.plexEnabled)
                newEnabledAuthMethods.push(MediaServerType.PLEX);
              if (values.jellyfinEnabled)
                newEnabledAuthMethods.push(MediaServerType.JELLYFIN);
              if (values.embyEnabled)
                newEnabledAuthMethods.push(MediaServerType.EMBY);

              await axios.post('/api/v1/settings/main', {
                localLogin: values.localLogin,
                enabledAuthMethods: newEnabledAuthMethods,
                newUserLogin: values.newUserLogin,
                defaultQuotas: {
                  movie: {
                    quotaLimit: values.movieQuotaLimit,
                    quotaDays: values.movieQuotaDays,
                  },
                  tv: {
                    quotaLimit: values.tvQuotaLimit,
                    quotaDays: values.tvQuotaDays,
                  },
                },
                defaultPermissions: values.defaultPermissions,
              });
              mutate('/api/v1/settings/public');

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
            }
          }}
        >
          {({ isSubmitting, isValid, values, errors, setFieldValue }) => {
            return (
              <Form className="section">
                <div
                  role="group"
                  aria-labelledby="group-label"
                  className="form-group"
                >
                  <div className="form-row">
                    <span id="group-label" className="group-label">
                      {intl.formatMessage(messages.loginMethods)}
                      <span className="label-tip">
                        {intl.formatMessage(messages.loginMethodsTip)}
                      </span>
                      {'localLogin' in errors && (
                        <span className="error">
                          {errors['localLogin'] as string}
                        </span>
                      )}
                    </span>

                    <div className="form-input-area max-w-lg">
                      <LabeledCheckbox
                        id="localLogin"
                        label={intl.formatMessage(messages.localLogin)}
                        description={intl.formatMessage(messages.localLoginTip)}
                        onChange={() =>
                          setFieldValue('localLogin', !values.localLogin)
                        }
                      />
                      {plexConfigured && (
                        <LabeledCheckbox
                          id="plexEnabled"
                          className="mt-4"
                          label={intl.formatMessage(messages.plexLogin)}
                          description={intl.formatMessage(
                            messages.plexLoginTip
                          )}
                          onChange={() =>
                            setFieldValue('plexEnabled', !values.plexEnabled)
                          }
                        />
                      )}
                      {(jellyfinConfigured || embyConfigured) && (
                        <LabeledCheckbox
                          id={
                            embyConfigured ? 'embyEnabled' : 'jellyfinEnabled'
                          }
                          className="mt-4"
                          label={intl.formatMessage(messages.jellyfinLogin, {
                            mediaServerName: jellyfinMediaServerName,
                          })}
                          description={intl.formatMessage(
                            messages.jellyfinLoginTip,
                            { mediaServerName: jellyfinMediaServerName }
                          )}
                          onChange={() => {
                            const field = embyConfigured
                              ? 'embyEnabled'
                              : 'jellyfinEnabled';
                            setFieldValue(field, !values[field]);
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <label htmlFor="newUserLogin" className="checkbox-label">
                    {intl.formatMessage(messages.newUserLogin)}
                    <span className="label-tip">
                      {intl.formatMessage(messages.newUserLoginTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="newUserLogin"
                      name="newUserLogin"
                      onChange={() => {
                        setFieldValue('newUserLogin', !values.newUserLogin);
                      }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="applicationTitle" className="text-label">
                    {intl.formatMessage(messages.movieRequestLimitLabel)}
                  </label>
                  <div className="form-input-area">
                    <QuotaSelector
                      onChange={setFieldValue}
                      dayFieldName="movieQuotaDays"
                      limitFieldName="movieQuotaLimit"
                      mediaType="movie"
                      defaultDays={values.movieQuotaDays}
                      defaultLimit={values.movieQuotaLimit}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="applicationTitle" className="text-label">
                    {intl.formatMessage(messages.tvRequestLimitLabel)}
                  </label>
                  <div className="form-input-area">
                    <QuotaSelector
                      onChange={setFieldValue}
                      dayFieldName="tvQuotaDays"
                      limitFieldName="tvQuotaLimit"
                      mediaType="tv"
                      defaultDays={values.tvQuotaDays}
                      defaultLimit={values.tvQuotaLimit}
                    />
                  </div>
                </div>
                <div
                  role="group"
                  aria-labelledby="group-label"
                  className="form-group"
                >
                  <div className="form-row">
                    <span id="group-label" className="group-label">
                      {intl.formatMessage(messages.defaultPermissions)}
                      <span className="label-tip">
                        {intl.formatMessage(messages.defaultPermissionsTip)}
                      </span>
                    </span>
                    <div className="form-input-area">
                      <div className="max-w-lg">
                        <PermissionEdit
                          currentPermission={values.defaultPermissions}
                          onUpdate={(newPermissions) =>
                            setFieldValue('defaultPermissions', newPermissions)
                          }
                        />
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
      </div>
    </>
  );
};

export default SettingsUsers;
