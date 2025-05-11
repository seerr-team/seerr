import Modal from '@app/components/Common/Modal';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { isValidURL } from '@app/utils/urlValidationHelper';
import type { NotificationAgentGotify } from '@server/interfaces/settings';
import { Field, Form, Formik } from 'formik';
import { useIntl } from 'react-intl';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.Settings.SettingsNotifications.NotificationModal',
  {
    instanceName: 'Name',
    gotifyUrl: 'Server URL',
    gotifyToken: 'Application Token',
    gotifyPriority: 'Priority',
    gotifyValidationUrlRequired: 'You must provide a valid URL',
    gotifyValidationUrlTrailingSlash: 'URL must not end in a trailing slash',
    gotifyValidationTokenRequired: 'You must provide an application token',
    gotifyValidationPriorityRequired: 'You must set a priority number',
    validationTypes: 'You must select at least one notification type',
  }
);

interface GotifyModalProps {
  title: string;
  data: NotificationAgentGotify;
  onClose: () => void;
  onTest: (testData: NotificationAgentGotify) => void;
  onSave: (submitData: NotificationAgentGotify) => void;
}

const GotifyModal = ({
  title,
  data,
  onClose,
  onTest,
  onSave,
}: GotifyModalProps) => {
  const intl = useIntl();

  const NotificationsGotifySchema = Yup.object().shape({
    url: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.gotifyValidationUrlRequired)),
        otherwise: Yup.string().nullable(),
      })
      .test(
        'valid-url',
        intl.formatMessage(messages.gotifyValidationUrlRequired),
        isValidURL
      )
      .test(
        'no-trailing-slash',
        intl.formatMessage(messages.gotifyValidationUrlTrailingSlash),
        (value) => !value || !value.endsWith('/')
      ),
    token: Yup.string().when('enabled', {
      is: true,
      then: Yup.string()
        .nullable()
        .required(intl.formatMessage(messages.gotifyValidationTokenRequired)),
      otherwise: Yup.string().nullable(),
    }),
    priority: Yup.string().when('enabled', {
      is: true,
      then: Yup.string()
        .nullable()
        .min(0)
        .max(9)
        .required(
          intl.formatMessage(messages.gotifyValidationPriorityRequired)
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
        url: data.options.url,
        token: data.options.token,
        priority: data.options.priority,
      }}
      validationSchema={NotificationsGotifySchema}
      onSubmit={async (values) => {
        await onSave({
          enabled: values.enabled,
          types: values.types,
          name: values.name,
          id: values.id,
          agent: values.agent,
          default: values.default,
          options: {
            url: values.url,
            token: values.token,
            priority: Number(values.priority),
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
                  url: values.url,
                  token: values.token,
                  priority: Number(values.priority),
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
                <label htmlFor="url" className="text-label">
                  {intl.formatMessage(messages.gotifyUrl)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field id="url" name="url" type="text" />
                  </div>
                  {errors.url &&
                    touched.url &&
                    typeof errors.url === 'string' && (
                      <div className="error">{errors.url}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="token" className="text-label">
                  {intl.formatMessage(messages.gotifyToken)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field id="token" name="token" type="text" />
                  </div>
                  {errors.token &&
                    touched.token &&
                    typeof errors.token === 'string' && (
                      <div className="error">{errors.token}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="priority" className="text-label">
                  {intl.formatMessage(messages.gotifyPriority)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <Field
                    id="priority"
                    name="priority"
                    type="text"
                    inputMode="numeric"
                    className="short"
                    autoComplete="off"
                    data-1pignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                  />
                  {errors.priority &&
                    touched.priority &&
                    typeof errors.priority === 'string' && (
                      <div className="error">{errors.priority}</div>
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

export default GotifyModal;
