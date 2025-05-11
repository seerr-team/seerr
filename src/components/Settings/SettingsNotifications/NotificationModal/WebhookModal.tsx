import Button from '@app/components/Common/Button';
import Modal from '@app/components/Common/Modal';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { isValidURL } from '@app/utils/urlValidationHelper';
import {
  ArrowPathIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/solid';
import type { NotificationAgentWebhook } from '@server/interfaces/settings';
import { Field, Form, Formik } from 'formik';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import * as Yup from 'yup';

const JSONEditor = dynamic(() => import('@app/components/JSONEditor'), {
  ssr: false,
});

const defaultPayload = {
  notification_type: '{{notification_type}}',
  event: '{{event}}',
  subject: '{{subject}}',
  message: '{{message}}',
  image: '{{image}}',
  '{{media}}': {
    media_type: '{{media_type}}',
    tmdbId: '{{media_tmdbid}}',
    tvdbId: '{{media_tvdbid}}',
    status: '{{media_status}}',
    status4k: '{{media_status4k}}',
  },
  '{{request}}': {
    request_id: '{{request_id}}',
    requestedBy_email: '{{requestedBy_email}}',
    requestedBy_username: '{{requestedBy_username}}',
    requestedBy_avatar: '{{requestedBy_avatar}}',
    requestedBy_settings_discordId: '{{requestedBy_settings_discordId}}',
    requestedBy_settings_telegramChatId:
      '{{requestedBy_settings_telegramChatId}}',
  },
  '{{issue}}': {
    issue_id: '{{issue_id}}',
    issue_type: '{{issue_type}}',
    issue_status: '{{issue_status}}',
    reportedBy_email: '{{reportedBy_email}}',
    reportedBy_username: '{{reportedBy_username}}',
    reportedBy_avatar: '{{reportedBy_avatar}}',
    reportedBy_settings_discordId: '{{reportedBy_settings_discordId}}',
    reportedBy_settings_telegramChatId:
      '{{reportedBy_settings_telegramChatId}}',
  },
  '{{comment}}': {
    comment_message: '{{comment_message}}',
    commentedBy_email: '{{commentedBy_email}}',
    commentedBy_username: '{{commentedBy_username}}',
    commentedBy_avatar: '{{commentedBy_avatar}}',
    commentedBy_settings_discordId: '{{commentedBy_settings_discordId}}',
    commentedBy_settings_telegramChatId:
      '{{commentedBy_settings_telegramChatId}}',
  },
  '{{extra}}': [],
};

const messages = defineMessages(
  'components.Settings.SettingsNotifications.NotificationModal',
  {
    instanceName: 'Name',
    webhookUrl: 'Webhook URL',
    webhookAuthheader: 'Authorization Header',
    webhookValidationJsonPayloadRequired:
      'You must provide a valid JSON payload',
    webhookResetPayload: 'Reset to Default',
    webhookResetPayloadSuccess: 'JSON payload reset successfully!',
    webhookCustomJson: 'JSON Payload',
    webhookTemplateVariableHelp: 'Template Variable Help',
    webhookValidationWebhookUrl: 'You must provide a valid URL',
    validationTypes: 'You must select at least one notification type',
  }
);

interface WebhookModalProps {
  title: string;
  data: NotificationAgentWebhook;
  onClose: () => void;
  onTest: (testData: NotificationAgentWebhook) => void;
  onSave: (submitData: NotificationAgentWebhook) => void;
}

const WebhookModal = ({
  title,
  data,
  onClose,
  onTest,
  onSave,
}: WebhookModalProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();

  const NotificationsWebhookSchema = Yup.object().shape({
    webhookUrl: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.webhookValidationWebhookUrl)),
        otherwise: Yup.string().nullable(),
      })
      .test(
        'valid-url',
        intl.formatMessage(messages.webhookValidationWebhookUrl),
        isValidURL
      ),
    jsonPayload: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(
            intl.formatMessage(messages.webhookValidationJsonPayloadRequired)
          ),
        otherwise: Yup.string().nullable(),
      })
      .test(
        'validate-json',
        intl.formatMessage(messages.webhookValidationJsonPayloadRequired),
        (value) => {
          try {
            JSON.parse(value ?? '');
            return true;
          } catch (e) {
            return false;
          }
        }
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
        webhookUrl: data.options.webhookUrl,
        jsonPayload: data.options.jsonPayload,
        authHeader: data.options.authHeader,
      }}
      validationSchema={NotificationsWebhookSchema}
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
            jsonPayload: values.jsonPayload,
            authHeader: values.authHeader,
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
        const resetPayload = () => {
          setFieldValue(
            'jsonPayload',
            JSON.stringify(defaultPayload, undefined, '    ')
          );
          addToast(intl.formatMessage(messages.webhookResetPayloadSuccess), {
            appearance: 'info',
            autoDismiss: true,
          });
        };

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
                  jsonPayload: values.jsonPayload,
                  authHeader: values.authHeader,
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
                <label htmlFor="webhookUrl" className="text-label">
                  {intl.formatMessage(messages.webhookUrl)}
                  <span className="label-required">*</span>
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
              <div className="form-row">
                <label htmlFor="authHeader" className="text-label">
                  {intl.formatMessage(messages.webhookAuthheader)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field id="authHeader" name="authHeader" type="text" />
                  </div>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="webhook-json-payload" className="text-label">
                  {intl.formatMessage(messages.webhookCustomJson)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <JSONEditor
                      name="webhook-json-payload"
                      onUpdate={(value) => setFieldValue('jsonPayload', value)}
                      value={values.jsonPayload}
                      onBlur={() => setFieldTouched('jsonPayload')}
                    />
                  </div>
                  {errors.jsonPayload &&
                    touched.jsonPayload &&
                    typeof errors.jsonPayload === 'string' && (
                      <div className="error">{errors.jsonPayload}</div>
                    )}
                  <div className="mt-2">
                    <Button
                      buttonSize="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        resetPayload();
                      }}
                      className="mr-2"
                    >
                      <ArrowPathIcon />
                      <span>
                        {intl.formatMessage(messages.webhookResetPayload)}
                      </span>
                    </Button>
                    <Link
                      href="https://docs.overseerr.dev/using-overseerr/notifications/webhooks#template-variables"
                      passHref
                      legacyBehavior
                    >
                      <Button
                        as="a"
                        buttonSize="sm"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <QuestionMarkCircleIcon />
                        <span>
                          {intl.formatMessage(
                            messages.webhookTemplateVariableHelp
                          )}
                        </span>
                      </Button>
                    </Link>
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

export default WebhookModal;
