import Alert from '@app/components/Common/Alert';
import Modal from '@app/components/Common/Modal';
import { NotificationModalType } from '@app/components/Settings/SettingsNotifications/NotificationModal';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import type { NotificationAgentConfig } from '@server/interfaces/settings';
import { Field, Form, Formik } from 'formik';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages(
  'components.Settings.SettingsNotifications.NotificationModal',
  {
    editTitle: 'Edit Notification Instance',
    createTitle: 'Create Notification Instance',
    createInstance: 'Create Instance',
    instanceName: 'Name',
    webPushHttpsRequirement:
      'In order to receive web push notifications, Jellyseerr must be served over HTTPS.',
  }
);

interface WebPushModalProps {
  type: NotificationModalType;
  data: NotificationAgentConfig;
  onClose: () => void;
  onTest: (testData: NotificationAgentConfig) => void;
  onSave: (submitData: NotificationAgentConfig) => void;
}

const WebPushModal = ({
  type,
  data,
  onClose,
  onTest,
  onSave,
}: WebPushModalProps) => {
  const intl = useIntl();
  const [isHttps, setIsHttps] = useState(false);

  useEffect(() => {
    setIsHttps(window.location.protocol.startsWith('https'));
  }, []);

  return (
    <>
      <Formik
        initialValues={{
          enabled: data.enabled,
          name: data.name,
          id: data.id,
          agent: data.agent,
          default: data.default,
        }}
        onSubmit={async (values) => {
          await onSave({
            enabled: values.enabled,
            name: values.name,
            id: values.id,
            agent: values.agent,
            default: values.default,
            options: {},
          });
        }}
      >
        {({ values, isSubmitting, handleSubmit }) => {
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
              secondaryDisabled={isSubmitting}
              onSecondary={() =>
                onTest({
                  enabled: values.enabled,
                  name: values.name,
                  id: values.id,
                  agent: values.agent,
                  default: values.default,
                  options: {},
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
              okDisabled={isSubmitting}
            >
              {!isHttps && (
                <Alert
                  title={intl.formatMessage(messages.webPushHttpsRequirement)}
                  type="warning"
                />
              )}

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
              </Form>
            </Modal>
          );
        }}
      </Formik>
    </>
  );
};

export default WebPushModal;
