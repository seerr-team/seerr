import Modal from '@app/components/Common/Modal';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import type { NotificationAgentPushbullet } from '@server/interfaces/settings';
import { Field, Form, Formik } from 'formik';
import { useIntl } from 'react-intl';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.Settings.SettingsNotifications.NotificationModal',
  {
    instanceName: 'Name',
    pushbulletAccessToken: 'Access Token',
    pushbulletAccessTokenTip:
      'Create a token from your <PushbulletSettingsLink>Account Settings</PushbulletSettingsLink>',
    pushbulletValidationAccessTokenRequired: 'You must provide an access token',
    pushbulletChannelTag: 'Channel Tag',
    validationTypes: 'You must select at least one notification type',
  }
);

interface PushbulletModalProps {
  title: string;
  data: NotificationAgentPushbullet;
  onClose: () => void;
  onTest: (testData: NotificationAgentPushbullet) => void;
  onSave: (submitData: NotificationAgentPushbullet) => void;
}

const PushbulletModal = ({
  title,
  data,
  onClose,
  onTest,
  onSave,
}: PushbulletModalProps) => {
  const intl = useIntl();

  const NotificationsPushbulletSchema = Yup.object().shape({
    accessToken: Yup.string().when('enabled', {
      is: true,
      then: Yup.string()
        .nullable()
        .required(
          intl.formatMessage(messages.pushbulletValidationAccessTokenRequired)
        ),
      otherwise: Yup.string().nullable(),
    }),
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
        channelTag: data.options.channelTag,
      }}
      validationSchema={NotificationsPushbulletSchema}
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
            channelTag: values.channelTag,
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
                  channelTag: values.channelTag,
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
                  {intl.formatMessage(messages.pushbulletAccessToken)}
                  <span className="label-required">*</span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.pushbulletAccessTokenTip, {
                      PushbulletSettingsLink: (msg: React.ReactNode) => (
                        <a
                          href="https://www.pushbullet.com/#settings/account"
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
                    <SensitiveInput
                      as="field"
                      id="accessToken"
                      name="accessToken"
                      autoComplete="one-time-code"
                    />
                  </div>
                  {errors.accessToken &&
                    touched.accessToken &&
                    typeof errors.accessToken === 'string' && (
                      <div className="error">{errors.accessToken}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="channelTag" className="text-label">
                  {intl.formatMessage(messages.pushbulletChannelTag)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field id="channelTag" name="channelTag" type="text" />
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

export default PushbulletModal;
