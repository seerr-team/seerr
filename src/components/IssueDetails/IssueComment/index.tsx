import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import Modal from '@app/components/Common/Modal';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Menu, Transition } from '@headlessui/react';
import { EllipsisVerticalIcon } from '@heroicons/react/24/solid';
import type { default as IssueCommentType } from '@server/entity/IssueComment';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { FormattedRelativeTime, useIntl } from 'react-intl';
import ReactMarkdown from 'react-markdown';
import * as Yup from 'yup';

const messages = defineMessages('components.IssueDetails.IssueComment', {
  postedby: 'Posted {relativeTime} by {username}',
  postedbyedited: 'Posted {relativeTime} by {username} (Edited)',
  delete: 'Delete Comment',
  areyousuredelete: 'Are you sure you want to delete this comment?',
  validationComment: 'You must enter a message',
  edit: 'Edit Comment',
});

interface IssueCommentProps {
  comment: IssueCommentType;
  isReversed?: boolean;
  isActiveUser?: boolean;
  onUpdate?: () => void;
}

const IssueComment = ({
  comment,
  isReversed = false,
  isActiveUser = false,
  onUpdate,
}: IssueCommentProps) => {
  const intl = useIntl();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { hasPermission } = useUser();

  const EditCommentSchema = Yup.object().shape({
    newMessage: Yup.string().required(
      intl.formatMessage(messages.validationComment)
    ),
  });

  const deleteComment = async () => {
    try {
      await axios.delete(`/api/v1/issueComment/${comment.id}`);
    } catch (e) {
      // something went wrong deleting the comment
    } finally {
      if (onUpdate) {
        onUpdate();
      }
    }
  };

  return (
    <div
      className={`flex ${
        isReversed ? 'flex-row' : 'flex-row-reverse space-x-reverse'
      } mt-4 space-x-4`}
    >
      <Transition
        as={Fragment}
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        show={showDeleteModal}
      >
        <Modal
          title={intl.formatMessage(messages.delete)}
          onCancel={() => setShowDeleteModal(false)}
          onOk={() => deleteComment()}
          okText={intl.formatMessage(messages.delete)}
          okButtonType="danger"
        >
          {intl.formatMessage(messages.areyousuredelete)}
        </Modal>
      </Transition>
      <Link href={isActiveUser ? '/profile' : `/users/${comment.user.id}`}>
        <CachedImage
          type="avatar"
          src={comment.user.avatar}
          alt=""
          className="h-10 w-10 scale-100 transform-gpu rounded-full object-cover ring-1 ring-gray-500 transition duration-300 hover:scale-105"
          width={40}
          height={40}
        />
      </Link>
      <div className="relative flex-1">
        <div className="w-full rounded-md shadow ring-1 ring-gray-500">
          {(isActiveUser || hasPermission(Permission.MANAGE_ISSUES)) && (
            <Menu
              as="div"
              className="absolute top-2 right-1 z-40 inline-block text-left"
            >
              {({ open }) => (
                <>
                  <div>
                    <Menu.Button className="flex items-center rounded-full text-gray-400 hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-100">
                      <span className="sr-only">Open options</span>
                      <EllipsisVerticalIcon
                        className="h-5 w-5"
                        aria-hidden="true"
                      />
                    </Menu.Button>
                  </div>

                  <Transition
                    as={Fragment}
                    show={open}
                    enter="transition ease-out duration-100"
                    enterFrom="opacity-0 scale-95"
                    enterTo="opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                  >
                    <Menu.Items
                      static
                      className="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-gray-700 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                    >
                      <div className="py-1">
                        {isActiveUser && (
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => setIsEditing(true)}
                                className={`block w-full px-4 py-2 text-left text-sm ${
                                  active
                                    ? 'bg-gray-600 text-white'
                                    : 'text-gray-100'
                                }`}
                              >
                                {intl.formatMessage(messages.edit)}
                              </button>
                            )}
                          </Menu.Item>
                        )}
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={() => setShowDeleteModal(true)}
                              className={`block w-full px-4 py-2 text-left text-sm ${
                                active
                                  ? 'bg-gray-600 text-white'
                                  : 'text-gray-100'
                              }`}
                            >
                              {intl.formatMessage(messages.delete)}
                            </button>
                          )}
                        </Menu.Item>
                      </div>
                    </Menu.Items>
                  </Transition>
                </>
              )}
            </Menu>
          )}
          <div
            className={`absolute top-3 z-10 h-3 w-3 rotate-45 bg-gray-800 shadow ring-1 ring-gray-500 ${
              isReversed ? '-left-1' : '-right-1'
            }`}
          />
          <div className="relative z-20 w-full rounded-md bg-gray-800 py-4 pl-4 pr-8">
            {isEditing ? (
              <Formik
                initialValues={{ newMessage: comment.message }}
                onSubmit={async (values) => {
                  await axios.put(`/api/v1/issueComment/${comment.id}`, {
                    message: values.newMessage,
                  });

                  if (onUpdate) {
                    onUpdate();
                  }

                  setIsEditing(false);
                }}
                validationSchema={EditCommentSchema}
              >
                {({ isValid, isSubmitting, errors, touched }) => {
                  return (
                    <Form>
                      <Field
                        as="textarea"
                        id="newMessage"
                        name="newMessage"
                        className="h-24"
                      />
                      {errors.newMessage &&
                        touched.newMessage &&
                        typeof errors.newMessage === 'string' && (
                          <div className="error">{errors.newMessage}</div>
                        )}
                      <div className="mt-4 flex items-center justify-end space-x-2">
                        <Button
                          type="button"
                          onClick={() => setIsEditing(false)}
                        >
                          {intl.formatMessage(globalMessages.cancel)}
                        </Button>
                        <Button
                          buttonType="primary"
                          disabled={!isValid || isSubmitting}
                        >
                          {intl.formatMessage(globalMessages.save)}
                        </Button>
                      </div>
                    </Form>
                  );
                }}
              </Formik>
            ) : (
              <div className="prose w-full max-w-full">
                <ReactMarkdown
                  skipHtml
                  allowedElements={['p', 'em', 'strong', 'ul', 'ol', 'li']}
                >
                  {comment.message}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
        <div
          className={`flex items-center justify-between pt-2 text-xs ${
            isReversed ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          <span>
            {intl.formatMessage(
              comment.createdAt !== comment.updatedAt
                ? messages.postedbyedited
                : messages.postedby,
              {
                username: (
                  <Link
                    href={
                      isActiveUser ? '/profile' : `/users/${comment.user.id}`
                    }
                    className="font-semibold text-gray-100 transition duration-300 hover:text-white hover:underline"
                  >
                    {comment.user.displayName}
                  </Link>
                ),
                relativeTime: (
                  <FormattedRelativeTime
                    value={Math.floor(
                      (new Date(comment.createdAt).getTime() - Date.now()) /
                        1000
                    )}
                    updateIntervalInSeconds={1}
                    numeric="auto"
                  />
                ),
              }
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default IssueComment;
