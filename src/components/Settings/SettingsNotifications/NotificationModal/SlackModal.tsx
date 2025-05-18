import Modal from '@app/components/Common/Modal';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import { NotificationModalType } from '@app/components/Settings/SettingsNotifications/NotificationModal';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import type { NotificationAgentSlack } from '@server/interfaces/settings';
import { Field, Form, Formik } from 'formik';
import { useIntl } from 'react-intl';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.Settings.SettingsNotifications.NotificationModal',
  {
    editTitle: 'Edit Notification Instance',
    createTitle: 'Create Notification Instance',
    createInstance: 'Create Instance',
    instanceName: 'Name',
    slackWebhookUrl: 'Webhook URL',
    slackWebhookUrlTip:
      'Create an <WebhookLink>Incoming Webhook</WebhookLink> integration',
    slackValidationWebhookUrl: 'You must provide a valid URL',
    validationTypes: 'You must select at least one notification type',
  }
);

interface SlackModalProps {
  type: NotificationModalType;
  data: NotificationAgentSlack;
  onClose: () => void;
  onTest: (testData: NotificationAgentSlack) => void;
  onSave: (submitData: NotificationAgentSlack) => void;
}

const SlackModal = ({
  type,
  data,
  onClose,
  onTest,
  onSave,
}: SlackModalProps) => {
  const intl = useIntl();

  const NotificationsSlackSchema = Yup.object().shape({
    webhookUrl: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.slackValidationWebhookUrl)),
        otherwise: Yup.string().nullable(),
      })
      .url(intl.formatMessage(messages.slackValidationWebhookUrl)),
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
        webhookUrl: data.options.webhookUrl,
      }}
      validationSchema={NotificationsSlackSchema}
      onSubmit={async (values) => {
        await onSave({
          enabled: values.enabled,
          types: values.types,
          name: values.name,
          id: values.id,
          agent: values.agent,
          default: values.default,
          options: {
            webhookUrl: values.webhookUrl,
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
        const title =
          type === NotificationModalType.EDIT
            ? `${intl.formatMessage(messages.editTitle)} #${data?.id}`
            : intl.formatMessage(messages.createTitle);

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
                  webhookUrl: values.webhookUrl,
                },
              })
            }
            okButtonType="primary"
            okText={
              isSubmitting
                ? intl.formatMessage(globalMessages.saving)
                : type === NotificationModalType.EDIT
                ? intl.formatMessage(globalMessages.save)
                : intl.formatMessage(messages.createInstance)
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
                <label htmlFor="name" className="text-label">
                  {intl.formatMessage(messages.slackWebhookUrl)}
                  <span className="label-required">*</span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.slackWebhookUrlTip, {
                      WebhookLink: (msg: React.ReactNode) => (
                        <a
                          href="https://my.slack.com/services/new/incoming-webhook/"
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
                    <Field
                      id="webhookUrl"
                      name="webhookUrl"
                      type="text"
                      inputMode="url"
                    />
                  </div>
                  {errors.webhookUrl &&
                    touched.webhookUrl &&
                    typeof errors.webhookUrl === 'string' && (
                      <div className="error">{errors.webhookUrl}</div>
                    )}
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

export default SlackModal;
