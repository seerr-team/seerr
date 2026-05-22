import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import useToasts from '@app/hooks/useToasts';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import {
  ArrowDownOnSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { Field, FieldArray, Form, Formik, getIn } from 'formik';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserMetadata',
  {
    metadata: 'Metadata',
    metadataDescription:
      'Manage custom metadata fields for this user. These fields will be included in webhook payloads.',
    toastSettingsSuccess: 'Metadata saved successfully!',
    toastSettingsFailure: 'Something went wrong while saving metadata.',
    keyPlaceholder: 'Key (e.g. discord_id)',
    valuePlaceholder: 'Value',
    sensitiveLabel: 'Sensitive',
    addField: 'Add Field',
    validationKeyRequired: 'Key is required if a value is provided',
    validationValueRequired: 'Value is required if a key is provided',
  }
);

interface MetadataField {
  key: string;
  value: string;
  isSensitive: boolean;
}

const UserMetadataAccountSettings = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const router = useRouter();

  const targetUserId = Number(router.query.userId);
  const { user, error } = useUser({ id: targetUserId });

  const {
    data,
    error: dataError,
    mutate: revalidate,
  } = useSWR<{ metadata: MetadataField[] }>(
    user ? `/api/v1/user/${user.id}/settings/metadata` : null
  );

  const MetadataSchema = Yup.object().shape({
    metadata: Yup.array().of(
      Yup.object().shape({
        key: Yup.string().test(
          'key-required',
          intl.formatMessage(messages.validationKeyRequired),
          function (value) {
            const { value: metaValue } = this.parent;
            if (metaValue && !value) return false;
            return true;
          }
        ),
        value: Yup.string().test(
          'value-required',
          intl.formatMessage(messages.validationValueRequired),
          function (value) {
            const { key: metaKey } = this.parent;
            if (metaKey && !value) return false;
            return true;
          }
        ),
        isSensitive: Yup.boolean(),
      })
    ),
  });

  if (!data && !dataError && !error) {
    return <LoadingSpinner />;
  }

  if (!data && (dataError || error)) {
    console.log(dataError);
    return <ErrorPage statusCode={500} />;
  }

  return (
    <>
      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.metadata)}</h3>
        <p className="mt-1 text-sm text-gray-400">
          {intl.formatMessage(messages.metadataDescription)}
        </p>
      </div>

      <Formik
        initialValues={{
          metadata: data?.metadata?.length
            ? data.metadata
            : [{ key: '', value: '', isSensitive: false }],
        }}
        validationSchema={MetadataSchema}
        enableReinitialize
        onSubmit={async (values, { resetForm }) => {
          try {
            const cleanedMetadata = values.metadata.filter(
              (field) => field.key.trim() !== '' || field.value.trim() !== ''
            );

            await axios.post(`/api/v1/user/${user?.id}/settings/metadata`, {
              metadata: cleanedMetadata,
            });

            addToast(intl.formatMessage(messages.toastSettingsSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch {
            addToast(intl.formatMessage(messages.toastSettingsFailure), {
              autoDismiss: true,
              appearance: 'error',
            });
          } finally {
            revalidate();
            resetForm({ values });
          }
        }}
      >
        {({ values, errors, touched, isSubmitting, isValid }) => (
          <Form className="section">
            <FieldArray name="metadata">
              {({ push, remove }) => (
                <div className="max-w-screen-md">
                  {values.metadata.map((field, index) => {
                    const keyError = getIn(errors, `metadata.${index}.key`);
                    const keyTouched = getIn(touched, `metadata.${index}.key`);
                    const valueError = getIn(errors, `metadata.${index}.value`);
                    const valueTouched = getIn(
                      touched,
                      `metadata.${index}.value`
                    );

                    return (
                      <div
                        key={index}
                        className="mb-6 flex flex-col gap-4 border-b border-gray-700/50 pb-6 last:mb-0 last:border-0 last:pb-0 md:flex-row md:items-start"
                      >
                        <div className="w-full md:flex-1">
                          <div className="!mt-0 w-full">
                            <div className="w-full">
                              <Field
                                name={`metadata.${index}.key`}
                                type="text"
                                placeholder={intl.formatMessage(
                                  messages.keyPlaceholder
                                )}
                              />
                            </div>
                            {keyError && keyTouched && (
                              <div className="error">{keyError}</div>
                            )}
                          </div>
                        </div>

                        <div className="w-full md:flex-1">
                          <div className="!mt-0 w-full">
                            <div className="flex w-full">
                              {field.isSensitive ? (
                                <SensitiveInput
                                  as="field"
                                  id={`metadata.${index}.value`}
                                  name={`metadata.${index}.value`}
                                  type="password"
                                  placeholder={intl.formatMessage(
                                    messages.valuePlaceholder
                                  )}
                                />
                              ) : (
                                <Field
                                  id={`metadata.${index}.value`}
                                  name={`metadata.${index}.value`}
                                  className="input"
                                  type="text"
                                  placeholder={intl.formatMessage(
                                    messages.valuePlaceholder
                                  )}
                                />
                              )}
                            </div>
                            {valueError && valueTouched && (
                              <div className="error">{valueError}</div>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 flex w-full items-center justify-between gap-4 md:mt-0 md:w-auto md:justify-end">
                          <div className="flex h-10 items-center space-x-2">
                            <Field
                              type="checkbox"
                              name={`metadata.${index}.isSensitive`}
                              className="h-5 w-5 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-medium text-gray-300">
                              {intl.formatMessage(messages.sensitiveLabel)}
                            </span>
                          </div>

                          <Button
                            type="button"
                            buttonType="danger"
                            onClick={() => remove(index)}
                            className="h-9 w-9 p-2"
                          >
                            <TrashIcon />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  <div className="mt-6">
                    <Button
                      type="button"
                      buttonType="default"
                      onClick={() =>
                        push({ key: '', value: '', isSensitive: false })
                      }
                    >
                      <PlusIcon className="mr-1 h-5 w-5" />
                      <span>{intl.formatMessage(messages.addField)}</span>
                    </Button>
                  </div>
                </div>
              )}
            </FieldArray>

            <div className="actions mt-6">
              <div className="flex justify-end">
                <span className="ml-3 inline-flex rounded-md shadow-sm">
                  <Button
                    buttonType="primary"
                    type="submit"
                    disabled={isSubmitting || !isValid}
                  >
                    <ArrowDownOnSquareIcon />
                    <span>
                      {isSubmitting
                        ? intl.formatMessage(globalMessages.saving)
                        : intl.formatMessage(globalMessages.save)}
                    </span>
                  </Button>
                </span>
              </div>
            </div>
          </Form>
        )}
      </Formik>
    </>
  );
};

export default UserMetadataAccountSettings;
