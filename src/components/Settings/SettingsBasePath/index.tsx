import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import SettingsBadge from '@app/components/Settings/SettingsBadge';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import {
  basePath as activeBasePath,
  normalizeBasePath,
} from '@app/utils/basePath';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import type { NetworkSettings } from '@server/lib/settings';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useIntl } from 'react-intl';
import useSWR, { mutate } from 'swr';
import * as Yup from 'yup';

const messages = defineMessages('components.Settings.SettingsBasePath', {
  heading: 'URL Base',
  description:
    'Host Seerr below a URL path such as /seerr. A restart is required after changing this setting.',
  field: 'URL Base',
  fieldTip:
    'Leave blank to serve Seerr from /. SEERR_BASE_PATH overrides this setting when provided by the environment.',
  active: 'Currently active: {basePath}',
  invalid:
    'Use an empty value or a path beginning with / containing only letters, numbers, dots, underscores, tildes, and hyphens.',
  toastSettingsSuccess: 'Settings saved successfully!',
  toastSettingsFailure: 'Something went wrong while saving settings.',
});

const SettingsBasePath = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<NetworkSettings>('/api/v1/settings/network');

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  const schema = Yup.object().shape({
    basePath: Yup.string().matches(
      /^(?:|\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*)$/,
      intl.formatMessage(messages.invalid)
    ),
  });

  return (
    <div className="section">
      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.heading)}</h3>
        <p className="description">
          {intl.formatMessage(messages.description)}
        </p>
      </div>
      <Formik
        initialValues={{ basePath: data?.basePath ?? '' }}
        enableReinitialize
        validationSchema={schema}
        onSubmit={async (values) => {
          try {
            await axios.post('/api/v1/settings/network', {
              basePath: normalizeBasePath(values.basePath),
            });
            await revalidate();
            mutate('/api/v1/status?checkUpdateAvailable=false');
            mutate('/api/v1/status?checkUpdateAvailable=true');

            addToast(intl.formatMessage(messages.toastSettingsSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch {
            addToast(intl.formatMessage(messages.toastSettingsFailure), {
              autoDismiss: true,
              appearance: 'error',
            });
          }
        }}
      >
        {({ errors, touched, isSubmitting, isValid }) => (
          <Form className="section">
            <div className="form-row">
              <label htmlFor="basePath" className="text-label">
                <span className="mr-2">
                  {intl.formatMessage(messages.field)}
                </span>
                <SettingsBadge badgeType="restartRequired" />
                <span className="label-tip">
                  {intl.formatMessage(messages.fieldTip)}
                </span>
                <span className="label-tip">
                  {intl.formatMessage(messages.active, {
                    basePath: activeBasePath || '/',
                  })}
                </span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    id="basePath"
                    name="basePath"
                    type="text"
                    placeholder="/seerr"
                  />
                </div>
                {errors.basePath && touched.basePath && (
                  <div className="error">{errors.basePath}</div>
                )}
              </div>
            </div>
            <div className="actions">
              <div className="flex justify-end">
                <Button
                  buttonType="primary"
                  type="submit"
                  disabled={isSubmitting || !isValid}
                >
                  <ArrowDownOnSquareIcon />
                  <span>{intl.formatMessage(globalMessages.save)}</span>
                </Button>
              </div>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default SettingsBasePath;
