import Modal from '@app/components/Common/Modal';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import type { PushoverSound } from '@server/api/pushover';
import type { NotificationAgentPushover } from '@server/interfaces/settings';
import { Field, Form, Formik } from 'formik';
import { useIntl } from 'react-intl';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.Settings.SettingsNotifications.NotificationModal',
  {
    instanceName: 'Name',
    pushoverAccessToken: 'Application API Token',
    pushoverAccessTokenTip:
      '<ApplicationRegistrationLink>Register an application</ApplicationRegistrationLink> for use with Jellyseerr',
    pushoverUserToken: 'User or Group Key',
    pushoverUserTokenTip:
      'Your 30-character <UsersGroupsLink>user or group identifier</UsersGroupsLink>',
    pushoverSound: 'Notification Sound',
    pushoverDeviceDefault: 'Device Default',
    pushoverValidationAccessTokenRequired:
      'You must provide a valid application token',
    pushoverValidationUserTokenRequired:
      'You must provide a valid user or group key',
    validationTypes: 'You must select at least one notification type',
  }
);

interface PushoverModalProps {
  title: string;
  data: NotificationAgentPushover;
  onClose: () => void;
  onTest: (testData: NotificationAgentPushover) => void;
  onSave: (submitData: NotificationAgentPushover) => void;
}

const PushoverModal = ({
  title,
  data,
  onClose,
  onTest,
  onSave,
}: PushoverModalProps) => {
  const intl = useIntl();
  const { data: soundsData } = useSWR<PushoverSound[]>(
    data.options.accessToken
      ? `/api/v1/settings/notifications/pushover/sounds?token=${data.options.accessToken}`
      : null
  );

  const NotificationsPushoverSchema = Yup.object().shape({
    accessToken: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(
            intl.formatMessage(messages.pushoverValidationAccessTokenRequired)
          ),
        otherwise: Yup.string().nullable(),
      })
      .matches(
        /^[a-z\d]{30}$/i,
        intl.formatMessage(messages.pushoverValidationAccessTokenRequired)
      ),
    userToken: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(
            intl.formatMessage(messages.pushoverValidationUserTokenRequired)
          ),
        otherwise: Yup.string().nullable(),
      })
      .matches(
        /^[a-z\d]{30}$/i,
        intl.formatMessage(messages.pushoverValidationUserTokenRequired)
      ),
  });

  return (
    <Formik
      initialValues={{
        enabled: data.enabled,
        types: data.types,
        name: data.name,
        id: data.id,
        agent: data.agent,
        default: data.default,
        accessToken: data.options.accessToken,
        userToken: data.options.userToken,
        sound: data.options.sound,
      }}
      validationSchema={NotificationsPushoverSchema}
      onSubmit={async (values) => {
        await onSave({
          enabled: values.enabled,
          types: values.types,
          name: values.name,
          id: values.id,
          agent: values.agent,
          default: values.default,
          options: {
            accessToken: values.accessToken,
            userToken: values.userToken,
            sound: values.sound,
          },
        });
      }}
    >
      {({
        errors,
        touched,
        isSubmitting,
        values,
        isValid,
        setFieldValue,
        setFieldTouched,
        handleSubmit,
      }) => {
        return (
          <Modal
            title={title}
            onCancel={() => onClose()}
            secondaryButtonType="warning"
            secondaryText={intl.formatMessage(globalMessages.test)}
            secondaryDisabled={isSubmitting || !isValid}
            onSecondary={() =>
              onTest({
                enabled: values.enabled,
                types: values.types,
                name: values.name,
                id: values.id,
                agent: values.agent,
                default: values.default,
                options: {
                  accessToken: values.accessToken,
                  userToken: values.userToken,
                  sound: values.sound,
                },
              })
            }
            okButtonType="primary"
            okText={
              isSubmitting
                ? intl.formatMessage(globalMessages.saving)
                : intl.formatMessage(globalMessages.save)
            }
            onOk={() => {
              handleSubmit();
            }}
            okDisabled={isSubmitting || !isValid}
          >
            <Form className="section">
              <div className="form-row">
                <label htmlFor="name" className="text-label">
                  {intl.formatMessage(messages.instanceName)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field id="name" name="name" type="text" />
                  </div>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="accessToken" className="text-label">
                  {intl.formatMessage(messages.pushoverAccessToken)}
                  <span className="label-required">*</span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.pushoverAccessTokenTip, {
                      ApplicationRegistrationLink: (msg: React.ReactNode) => (
                        <a
                          href="https://pushover.net/api#registration"
                          className="text-white transition duration-300 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {msg}
                        </a>
                      ),
                    })}
                  </span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field id="accessToken" name="accessToken" type="text" />
                  </div>
                  {errors.accessToken &&
                    touched.accessToken &&
                    typeof errors.accessToken === 'string' && (
                      <div className="error">{errors.accessToken}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="userToken" className="text-label">
                  {intl.formatMessage(messages.pushoverUserToken)}
                  <span className="label-required">*</span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.pushoverUserTokenTip, {
                      UsersGroupsLink: (msg: React.ReactNode) => (
                        <a
                          href="https://pushover.net/api#identifiers"
                          className="text-white transition duration-300 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {msg}
                        </a>
                      ),
                    })}
                  </span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field id="userToken" name="userToken" type="text" />
                  </div>
                  {errors.userToken &&
                    touched.userToken &&
                    typeof errors.userToken === 'string' && (
                      <div className="error">{errors.userToken}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="sound" className="text-label">
                  {intl.formatMessage(messages.pushoverSound)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      as="select"
                      id="sound"
                      name="sound"
                      disabled={!soundsData?.length}
                    >
                      <option value="">
                        {intl.formatMessage(messages.pushoverDeviceDefault)}
                      </option>
                      {soundsData?.map((sound, index) => (
                        <option key={`sound-${index}`} value={sound.name}>
                          {sound.description}
                        </option>
                      ))}
                    </Field>
                  </div>
                </div>
              </div>
              <NotificationTypeSelector
                currentTypes={values.enabled && values.types ? values.types : 0}
                onUpdate={(newTypes) => {
                  setFieldValue('types', newTypes);
                  setFieldTouched('types');

                  if (newTypes) {
                    setFieldValue('enabled', true);
                  }
                }}
                error={
                  values.enabled && !values.types && touched.types
                    ? intl.formatMessage(messages.validationTypes)
                    : undefined
                }
              />
            </Form>
          </Modal>
        );
      }}
    </Formik>
  );
};

export default PushoverModal;
