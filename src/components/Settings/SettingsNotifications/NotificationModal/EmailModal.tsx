import Modal from '@app/components/Common/Modal';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import SettingsBadge from '@app/components/Settings/SettingsBadge';
import { NotificationModalType } from '@app/components/Settings/SettingsNotifications/NotificationModal';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import type { NotificationAgentEmail } from '@server/interfaces/settings';
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
    emailValidationSmtpHostRequired:
      'You must provide a valid hostname or IP address',
    emailValidationSmtpPortRequired: 'You must provide a valid port number',
    emailUserRequired: 'Require user email',
    emailSender: 'Sender Address',
    emailSmtpHost: 'SMTP Host',
    emailSmtpPort: 'SMTP Port',
    emailEncryption: 'Encryption Method',
    emailEncryptionTip:
      'In most cases, Implicit TLS uses port 465 and STARTTLS uses port 587',
    emailEncryptionNone: 'None',
    emailEncryptionDefault: 'Use STARTTLS if available',
    emailEncryptionOpportunisticTls: 'Always use STARTTLS',
    emailEncryptionImplicitTls: 'Use Implicit TLS',
    emailAuthUser: 'SMTP Username',
    emailAuthPass: 'SMTP Password',
    emailAllowSelfSigned: 'Allow Self-Signed Certificates',
    emailSenderName: 'Sender Name',
    emailValidation: 'You must provide a valid email address',
    emailPgpPrivateKey: 'PGP Private Key',
    emailPgpPrivateKeyTip:
      'Sign encrypted email messages using <OpenPgpLink>OpenPGP</OpenPgpLink>',
    emailValidationPgpPrivateKey: 'You must provide a valid PGP private key',
    emailPgpPassword: 'PGP Password',
    emailPgpPasswordTip:
      'Sign encrypted email messages using <OpenPgpLink>OpenPGP</OpenPgpLink>',
    emailValidationPgpPassword: 'You must provide a PGP password',
  }
);

export function OpenPgpLink(msg: React.ReactNode) {
  return (
    <a href="https://www.openpgp.org/" target="_blank" rel="noreferrer">
      {msg}
    </a>
  );
}

interface EmailModalProps {
  type: NotificationModalType;
  data: NotificationAgentEmail;
  onClose: () => void;
  onTest: (testData: NotificationAgentEmail) => void;
  onSave: (submitData: NotificationAgentEmail) => void;
}

const EmailModal = ({
  type,
  data,
  onClose,
  onTest,
  onSave,
}: EmailModalProps) => {
  const intl = useIntl();

  const NotificationsEmailSchema = Yup.object().shape(
    {
      emailFrom: Yup.string()
        .when('enabled', {
          is: true,
          then: Yup.string()
            .nullable()
            .required(intl.formatMessage(messages.emailValidation)),
          otherwise: Yup.string().nullable(),
        })
        .email(intl.formatMessage(messages.emailValidation)),
      smtpHost: Yup.string().when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(
            intl.formatMessage(messages.emailValidationSmtpHostRequired)
          ),
        otherwise: Yup.string().nullable(),
      }),
      smtpPort: Yup.number().when('enabled', {
        is: true,
        then: Yup.number()
          .nullable()
          .required(
            intl.formatMessage(messages.emailValidationSmtpPortRequired)
          ),
        otherwise: Yup.number().nullable(),
      }),
      pgpPrivateKey: Yup.string()
        .when('pgpPassword', {
          is: (value: unknown) => !!value,
          then: Yup.string()
            .nullable()
            .required(
              intl.formatMessage(messages.emailValidationPgpPrivateKey)
            ),
          otherwise: Yup.string().nullable(),
        })
        .matches(
          /-----BEGIN PGP PRIVATE KEY BLOCK-----.+-----END PGP PRIVATE KEY BLOCK-----/,
          intl.formatMessage(messages.emailValidationPgpPrivateKey)
        ),
      pgpPassword: Yup.string().when('pgpPrivateKey', {
        is: (value: unknown) => !!value,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.emailValidationPgpPassword)),
        otherwise: Yup.string().nullable(),
      }),
    },
    [['pgpPrivateKey', 'pgpPassword']]
  );

  return (
    <Formik
      initialValues={{
        enabled: data.enabled,
        name: data.name,
        id: data.id,
        agent: data.agent,
        default: data.default,
        userEmailRequired: data.options.userEmailRequired,
        emailFrom: data.options.emailFrom,
        smtpHost: data.options.smtpHost,
        smtpPort: data.options.smtpPort ?? 587,
        encryption: data.options.secure
          ? 'implicit'
          : data.options.requireTls
          ? 'opportunistic'
          : data.options.ignoreTls
          ? 'none'
          : 'default',
        authUser: data.options.authUser,
        authPass: data.options.authPass,
        allowSelfSigned: data.options.allowSelfSigned,
        senderName: data.options.senderName,
        pgpPrivateKey: data.options.pgpPrivateKey,
        pgpPassword: data.options.pgpPassword,
      }}
      validationSchema={NotificationsEmailSchema}
      onSubmit={async (values) => {
        await onSave({
          enabled: values.enabled,
          name: values.name,
          id: values.id,
          agent: values.agent,
          default: values.default,
          options: {
            userEmailRequired: values.userEmailRequired,
            emailFrom: values.emailFrom,
            smtpHost: values.smtpHost,
            smtpPort: Number(values.smtpPort),
            secure: values.encryption === 'implicit',
            ignoreTls: values.encryption === 'none',
            requireTls: values.encryption === 'opportunistic',
            authUser: values.authUser,
            authPass: values.authPass,
            allowSelfSigned: values.allowSelfSigned,
            senderName: values.senderName,
            pgpPrivateKey: values.pgpPrivateKey,
            pgpPassword: values.pgpPassword,
          },
        });
      }}
    >
      {({ errors, touched, isSubmitting, values, isValid, handleSubmit }) => {
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
                name: values.name,
                id: values.id,
                agent: values.agent,
                default: values.default,
                options: {
                  userEmailRequired: values.userEmailRequired,
                  emailFrom: values.emailFrom,
                  smtpHost: values.smtpHost,
                  smtpPort: Number(values.smtpPort),
                  secure: values.encryption === 'implicit',
                  ignoreTls: values.encryption === 'none',
                  requireTls: values.encryption === 'opportunistic',
                  authUser: values.authUser,
                  authPass: values.authPass,
                  allowSelfSigned: values.allowSelfSigned,
                  senderName: values.senderName,
                  pgpPrivateKey: values.pgpPrivateKey,
                  pgpPassword: values.pgpPassword,
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
                <label htmlFor="userEmailRequired" className="checkbox-label">
                  {intl.formatMessage(messages.emailUserRequired)}
                </label>
                <div className="form-input-area">
                  <Field
                    type="checkbox"
                    id="userEmailRequired"
                    name="userEmailRequired"
                  />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="senderName" className="text-label">
                  {intl.formatMessage(messages.emailSenderName)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field id="senderName" name="senderName" type="text" />
                  </div>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="emailFrom" className="text-label">
                  {intl.formatMessage(messages.emailSender)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      id="emailFrom"
                      name="emailFrom"
                      type="text"
                      inputMode="email"
                      autoComplete="off"
                      data-form-type="other"
                      data-1pignore="true"
                      data-lpignore="true"
                      data-bwignore="true"
                    />
                  </div>
                  {errors.emailFrom &&
                    touched.emailFrom &&
                    typeof errors.emailFrom === 'string' && (
                      <div className="error">{errors.emailFrom}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="smtpHost" className="text-label">
                  {intl.formatMessage(messages.emailSmtpHost)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      id="smtpHost"
                      name="smtpHost"
                      type="text"
                      inputMode="url"
                      autoComplete="off"
                      data-form-type="other"
                      data-1pignore="true"
                      data-lpignore="true"
                      data-bwignore="true"
                    />
                  </div>
                  {errors.smtpHost &&
                    touched.smtpHost &&
                    typeof errors.smtpHost === 'string' && (
                      <div className="error">{errors.smtpHost}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="smtpPort" className="text-label">
                  {intl.formatMessage(messages.emailSmtpPort)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <Field
                    id="smtpPort"
                    name="smtpPort"
                    type="text"
                    inputMode="numeric"
                    className="short"
                    autoComplete="off"
                    data-form-type="other"
                    data-1pignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                  />
                  {errors.smtpPort &&
                    touched.smtpPort &&
                    typeof errors.smtpPort === 'string' && (
                      <div className="error">{errors.smtpPort}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="encryption" className="text-label">
                  {intl.formatMessage(messages.emailEncryption)}
                  <span className="label-required">*</span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.emailEncryptionTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field as="select" id="encryption" name="encryption">
                      <option value="none">
                        {intl.formatMessage(messages.emailEncryptionNone)}
                      </option>
                      <option value="default">
                        {intl.formatMessage(messages.emailEncryptionDefault)}
                      </option>
                      <option value="opportunistic">
                        {intl.formatMessage(
                          messages.emailEncryptionOpportunisticTls
                        )}
                      </option>
                      <option value="implicit">
                        {intl.formatMessage(
                          messages.emailEncryptionImplicitTls
                        )}
                      </option>
                    </Field>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="allowSelfSigned" className="checkbox-label">
                  {intl.formatMessage(messages.emailAllowSelfSigned)}
                </label>
                <div className="form-input-area">
                  <Field
                    type="checkbox"
                    id="allowSelfSigned"
                    name="allowSelfSigned"
                  />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="authUser" className="text-label">
                  {intl.formatMessage(messages.emailAuthUser)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      id="authUser"
                      name="authUser"
                      type="text"
                      autoComplete="off"
                      data-form-type="other"
                      data-1pignore="true"
                      data-lpignore="true"
                      data-bwignore="true"
                    />
                  </div>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="authPass" className="text-label">
                  {intl.formatMessage(messages.emailAuthPass)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <SensitiveInput as="field" id="authPass" name="authPass" />
                  </div>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="pgpPrivateKey" className="text-label">
                  <span className="mr-2">
                    {intl.formatMessage(messages.emailPgpPrivateKey)}
                  </span>
                  <SettingsBadge badgeType="advanced" />
                  <span className="label-tip">
                    {intl.formatMessage(messages.emailPgpPrivateKeyTip, {
                      OpenPgpLink: OpenPgpLink,
                    })}
                  </span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <SensitiveInput
                      as="field"
                      id="pgpPrivateKey"
                      name="pgpPrivateKey"
                      type="textarea"
                      rows="10"
                      className="font-mono text-xs"
                      autoComplete="off"
                      data-form-type="other"
                      data-1pignore="true"
                      data-lpignore="true"
                      data-bwignore="true"
                    />
                  </div>
                  {errors.pgpPrivateKey &&
                    touched.pgpPrivateKey &&
                    typeof errors.pgpPrivateKey === 'string' && (
                      <div className="error">{errors.pgpPrivateKey}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="pgpPassword" className="text-label">
                  <span className="mr-2">
                    {intl.formatMessage(messages.emailPgpPassword)}
                  </span>
                  <SettingsBadge badgeType="advanced" />
                  <span className="label-tip">
                    {intl.formatMessage(messages.emailPgpPasswordTip, {
                      OpenPgpLink: OpenPgpLink,
                    })}
                  </span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <SensitiveInput
                      as="field"
                      id="pgpPassword"
                      name="pgpPassword"
                      autoComplete="off"
                      data-form-type="other"
                      data-1pignore="true"
                      data-lpignore="true"
                      data-bwignore="true"
                    />
                  </div>
                  {errors.pgpPassword &&
                    touched.pgpPassword &&
                    typeof errors.pgpPassword === 'string' && (
                      <div className="error">{errors.pgpPassword}</div>
                    )}
                </div>
              </div>
            </Form>
          </Modal>
        );
      }}
    </Formik>
  );
};

export default EmailModal;
