import Modal from '@app/components/Common/Modal';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { ApiErrorCode } from '@server/constants/error';
import axios from 'axios';
import { Field, Formik } from 'formik';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import { mutate } from 'swr';
import validator from 'validator';
import * as Yup from 'yup';

const messages = defineMessages('components.Login', {
  title: 'Add Email',
  description:
    'Add a valid email address to complete your profile. This will be used for notifications and local sign-in.',
  email: 'Email address',
  emailAlreadyTaken: 'This email is already in use.',
  validationEmailRequired: 'You must provide an email',
  validationEmailFormat: 'Invalid email',
  saving: 'Adding…',
  save: 'Add',
  saveFailed: 'Something went wrong while saving.',
});

interface AddEmailModalProps {
  onClose: () => void;
  onSave: () => void;
}

const AddEmailModal: React.FC<AddEmailModalProps> = ({ onClose, onSave }) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { user } = useUser();

  const EmailSchema = Yup.object().shape({
    email: Yup.string()
      .test(
        'email',
        intl.formatMessage(messages.validationEmailFormat),
        (value) => !value || validator.isEmail(value, { require_tld: false })
      )
      .required(intl.formatMessage(messages.validationEmailRequired)),
  });

  return (
    <Transition
      appear
      show
      enter="transition ease-in-out duration-300 transform opacity-0"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition ease-in-out duration-300 transform opacity-100"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <Formik
        initialValues={{ email: '' }}
        validationSchema={EmailSchema}
        onSubmit={async (values) => {
          if (!user?.id) {
            addToast(intl.formatMessage(messages.saveFailed), {
              autoDismiss: true,
              appearance: 'error',
            });
            return;
          }

          try {
            const { data: current } = await axios.get(
              `/api/v1/user/${user.id}/settings/main`
            );
            await axios.post(`/api/v1/user/${user.id}/settings/main`, {
              ...current,
              email: values.email,
            });
            await mutate(`/api/v1/user/${user.id}/settings/main`);
            onSave();
          } catch (e) {
            addToast(
              intl.formatMessage(
                axios.isAxiosError(e) &&
                  e.response?.data?.message === ApiErrorCode.InvalidEmail
                  ? messages.emailAlreadyTaken
                  : messages.saveFailed
              ),
              {
                autoDismiss: true,
                appearance: 'error',
              }
            );
          }
        }}
      >
        {({ errors, touched, handleSubmit, isSubmitting, isValid }) => (
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
            {intl.formatMessage(messages.description)}
            <label htmlFor="email" className="text-label">
              {intl.formatMessage(messages.email)}
            </label>
            <div className="mb-2 mt-1 sm:col-span-2 sm:mt-0">
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
        )}
      </Formik>
    </Transition>
  );
};

export default AddEmailModal;
