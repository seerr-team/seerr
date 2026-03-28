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
  mediaServerLogin: 'Enable {mediaServerName} Sign-In',
  mediaServerLoginTip:
    'Allow users to sign in using their {mediaServerName} account',
  atLeastOneAuth: 'At least one authentication method must be selected.',
  newUserLogin: 'Enable New User Sign-In',
  newUserLoginTip: 'Allow users to sign in without first being imported',
  movieRequestLimitLabel: 'Global Movie Request Limit',
  tvRequestLimitLabel: 'Global Series Request Limit',
  defaultPermissions: 'Default Permissions',
  defaultPermissionsTip: 'Initial permissions assigned to new users',
});

type SettingsUsersFormValues = {
  localLogin?: boolean;
  plexLogin?: boolean;
  jellyfinLogin?: boolean;
  embyLogin?: boolean;
  newUserLogin?: boolean;
  movieQuotaLimit: number;
  movieQuotaDays: number;
  tvQuotaLimit: number;
  tvQuotaDays: number;
  defaultPermissions: number;
};

const getInitialProviderLogin = ({
  providerLogin,
  mediaServerLogin,
  configured,
}: {
  providerLogin?: boolean;
  mediaServerLogin?: boolean;
  configured: boolean;
}): boolean =>
  configured &&
  Boolean(mediaServerLogin && (providerLogin ?? mediaServerLogin));

const getEffectiveProviderLogins = (
  values: Pick<
    SettingsUsersFormValues,
    'plexLogin' | 'jellyfinLogin' | 'embyLogin'
  >,
  options: {
    plexConfigured: boolean;
    jellyfinConfigured: boolean;
    embyConfigured: boolean;
  }
) => ({
  effectivePlexLogin: options.plexConfigured && Boolean(values.plexLogin),
  effectiveJellyfinLogin:
    options.jellyfinConfigured && Boolean(values.jellyfinLogin),
  effectiveEmbyLogin: options.embyConfigured && Boolean(values.embyLogin),
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
  const plexConfigured = settings.currentSettings.mediaServers.some(
    (server) => server.mediaServerType === MediaServerType.PLEX
  );
  const jellyfinConfigured = settings.currentSettings.mediaServers.some(
    (server) => server.mediaServerType === MediaServerType.JELLYFIN
  );
  const embyConfigured = settings.currentSettings.mediaServers.some(
    (server) => server.mediaServerType === MediaServerType.EMBY
  );

  const schema = yup
    .object()
    .shape({
      localLogin: yup.boolean(),
      plexLogin: yup.boolean(),
      jellyfinLogin: yup.boolean(),
      embyLogin: yup.boolean(),
    })
    .test({
      name: 'atLeastOneAuth',
      test: function (values) {
        const {
          effectivePlexLogin,
          effectiveJellyfinLogin,
          effectiveEmbyLogin,
        } = getEffectiveProviderLogins(values, {
          plexConfigured,
          jellyfinConfigured,
          embyConfigured,
        });
        const isValid =
          Boolean(values.localLogin) ||
          effectivePlexLogin ||
          effectiveJellyfinLogin ||
          effectiveEmbyLogin;

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
            plexLogin: getInitialProviderLogin({
              providerLogin: data?.plexLogin,
              mediaServerLogin: data?.mediaServerLogin,
              configured: plexConfigured,
            }),
            jellyfinLogin: getInitialProviderLogin({
              providerLogin: data?.jellyfinLogin,
              mediaServerLogin: data?.mediaServerLogin,
              configured: jellyfinConfigured,
            }),
            embyLogin: getInitialProviderLogin({
              providerLogin: data?.embyLogin,
              mediaServerLogin: data?.mediaServerLogin,
              configured: embyConfigured,
            }),
            newUserLogin: data?.newPlexLogin,
            movieQuotaLimit: data?.defaultQuotas.movie.quotaLimit ?? 0,
            movieQuotaDays: data?.defaultQuotas.movie.quotaDays ?? 7,
            tvQuotaLimit: data?.defaultQuotas.tv.quotaLimit ?? 0,
            tvQuotaDays: data?.defaultQuotas.tv.quotaDays ?? 7,
            defaultPermissions: data?.defaultPermissions ?? 0,
          }}
          validationSchema={schema}
          enableReinitialize
          onSubmit={async (values: SettingsUsersFormValues) => {
            try {
              const {
                effectivePlexLogin,
                effectiveJellyfinLogin,
                effectiveEmbyLogin,
              } = getEffectiveProviderLogins(values, {
                plexConfigured,
                jellyfinConfigured,
                embyConfigured,
              });
              const mediaServerLogin =
                effectivePlexLogin ||
                effectiveJellyfinLogin ||
                effectiveEmbyLogin;
              await axios.post('/api/v1/settings/main', {
                localLogin: values.localLogin,
                mediaServerLogin,
                plexLogin: effectivePlexLogin,
                jellyfinLogin: effectiveJellyfinLogin,
                embyLogin: effectiveEmbyLogin,
                newPlexLogin: values.newUserLogin,
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
            } catch {
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
                          {errors.localLogin as string}
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
                          id="plexLogin"
                          className="mt-4"
                          label={intl.formatMessage(messages.plexLogin)}
                          description={intl.formatMessage(
                            messages.plexLoginTip
                          )}
                          onChange={() =>
                            setFieldValue('plexLogin', !values.plexLogin)
                          }
                        />
                      )}
                      {jellyfinConfigured && (
                        <LabeledCheckbox
                          id="jellyfinLogin"
                          className="mt-4"
                          label={intl.formatMessage(messages.mediaServerLogin, {
                            mediaServerName: 'Jellyfin',
                          })}
                          description={intl.formatMessage(
                            messages.mediaServerLoginTip,
                            {
                              mediaServerName: 'Jellyfin',
                            }
                          )}
                          onChange={() =>
                            setFieldValue(
                              'jellyfinLogin',
                              !values.jellyfinLogin
                            )
                          }
                        />
                      )}
                      {embyConfigured && (
                        <LabeledCheckbox
                          id="embyLogin"
                          className="mt-4"
                          label={intl.formatMessage(messages.mediaServerLogin, {
                            mediaServerName: 'Emby',
                          })}
                          description={intl.formatMessage(
                            messages.mediaServerLoginTip,
                            {
                              mediaServerName: 'Emby',
                            }
                          )}
                          onChange={() =>
                            setFieldValue('embyLogin', !values.embyLogin)
                          }
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
