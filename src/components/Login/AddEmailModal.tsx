import Modal from '@app/components/Common/Modal';
import useSettings from '@app/hooks/useSettings';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import axios from 'axios';
import { Field, Formik } from 'formik';
import { useIntl } from 'react-intl';
import * as Yup from 'yup';

const messages = defineMessages('components.Login', {
  title: 'Add Email',
  description:
    'Since this is your first time logging into {applicationName}, you are required to add a valid email address.',
  email: 'Email address',
  validationEmailRequired: 'You must provide an email',
  validationEmailFormat: 'Invalid email',
  saving: 'Adding…',
  save: 'Add',
});

interface AddEmailModalProps {
  username: string;
  password: string;
  onClose: () => void;
  onSave: () => void;
}

const AddEmailModal: React.FC<AddEmailModalProps> = ({
  onClose,
  username,
  password,
  onSave,
}) => {
  const intl = useIntl();
  const settings = useSettings();

  const EmailSettingsSchema = Yup.object().shape({
    email: Yup.string()
      .email(intl.formatMessage(messages.validationEmailFormat))
      .required(intl.formatMessage(messages.validationEmailRequired)),
  });

  return (
    <Transition
      appear
      show
      enter="transition ease-in-out duration-300 transform opacity-0"
      enterFrom="opacity-0"
      enterTo="opacuty-100"
      leave="transition ease-in-out duration-300 transform opacity-100"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <Formik
        initialValues={{
          email: '',
        }}
        validationSchema={EmailSettingsSchema}
        onSubmit={async (values) => {
          try {
            await axios.post('/api/v1/auth/jellyfin', {
              username: username,
              password: password,
              email: values.email,
            });

            onSave();
          } catch (e) {
            // set error here
          }
        }}
      >
        {({ errors, touched, handleSubmit, isSubmitting, isValid }) => {
          return (
            <Modal
              onCancel={onClose}
              okButtonType="primary"
              okText={
                isSubmitting
                  ? intl.formatMessage(messages.saving)
                  : intl.formatMessage(messages.save)
              }
              okDisabled={isSubmitting || !isValid}
              onOk={() => handleSubmit()}
              title={intl.formatMessage(messages.title)}
            >
              {intl.formatMessage(messages.description, {
                applicationName: settings.currentSettings.applicationTitle,
              })}
              <label htmlFor="email" className="text-label">
                {intl.formatMessage(messages.email)}
              </label>
              <div className="mt-1 mb-2 sm:col-span-2 sm:mt-0">
                <div className="flex rounded-md shadow-sm">
                  <Field
                    id="email"
                    name="email"
                    type="text"
                    placeholder={intl.formatMessage(messages.email)}
                  />
                </div>
                {errors.email && touched.email && (
                  <div className="error">{errors.email}</div>
                )}
              </div>
            </Modal>
          );
        }}
      </Formik>
    </Transition>
  );
};

export default AddEmailModal;
