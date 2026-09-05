/* eslint-disable @typescript-eslint/no-unused-vars */
import Button from '@app/components/Common/Button';
import Modal from '@app/components/Common/Modal';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { NonFunctionProperties } from '@server/interfaces/api/common';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useIntl } from 'react-intl';
import * as Yup from 'yup';

const messages = defineMessages('components.DeclineRequestModal', {
  reasonLabel: 'Reason for declining?',
  leaveComment: "Leave a comment for {username}'s request.",
  declinePlaceholder: 'Optionally leave a reason for declining the request.',
  cancelButtonLabel: 'Cancel',
  declineButtonLabel: 'Decline Request',
});

interface DeclineRequestModalProps {
  show: boolean;
  type: 'movie' | 'tv' | 'collection';
  requests?: NonFunctionProperties<MediaRequest>[];
  onComplete?: () => void;
  onCancel?: () => void;
  onError?: () => void;
}

const DeclineRequestModal = ({
  type,
  show,
  requests,
  onComplete,
  onCancel,
  onError,
}: DeclineRequestModalProps) => {
  const intl = useIntl();

  const CommentSchema = Yup.object().shape({
    reason: Yup.string(),
  });

  const request = requests?.at(0);

  const handleSubmit = async (
    requestId: number,
    values: { reason: string }
  ) => {
    try {
      await axios.post(`/api/v1/request/${requestId}/decline`, {
        declineReason: values.reason,
      });
    } catch {
      if (onError) {
        onError();
      }
    }
  };

  return (
    <Transition
      as="div"
      enter="transition-opacity duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
      show={show}
    >
      <Modal
        loading={false}
        backgroundClickable
        title={intl.formatMessage(messages.reasonLabel)}
        subTitle={intl.formatMessage(messages.leaveComment, {
          username: request?.requestedBy.displayName ?? '',
        })}
      >
        {
          <Formik
            initialValues={{
              reason: '',
            }}
            validationSchema={CommentSchema}
            onSubmit={async (values, { resetForm }) => {
              if (requests) {
                const results = await Promise.allSettled(
                  requests.map((req) => handleSubmit(req.id, values))
                );
                results.forEach((result, index) => {
                  if (result.status === 'rejected') {
                    throw new Error(result.reason);
                  }
                });
              }
              resetForm();
              if (onComplete) {
                onComplete();
              }
            }}
          >
            {({ isValid, isSubmitting, values, handleSubmit }) => {
              return (
                <Form>
                  <div className="my-6">
                    <Field
                      id="reason"
                      name="reason"
                      as="textarea"
                      placeholder={intl.formatMessage(
                        messages.declinePlaceholder
                      )}
                      className="h-20"
                    />
                    <div className="mt-4 flex items-center justify-end space-x-2">
                      {
                        <Button
                          type="button"
                          buttonType="default"
                          onClick={async () => {
                            if (onCancel) {
                              onCancel();
                            }
                          }}
                        >
                          <span>
                            {intl.formatMessage(messages.cancelButtonLabel)}
                          </span>
                        </Button>
                      }
                      <Button
                        type="submit"
                        buttonType="danger"
                        disabled={!isValid || isSubmitting}
                      >
                        <span>
                          {intl.formatMessage(messages.declineButtonLabel)}
                        </span>
                      </Button>
                    </div>
                  </div>
                </Form>
              );
            }}
          </Formik>
        }
      </Modal>
    </Transition>
  );
};

export default DeclineRequestModal;
