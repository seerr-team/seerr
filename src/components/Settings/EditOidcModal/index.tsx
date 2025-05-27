import Accordion from '@app/components/Common/Accordion';
import Modal from '@app/components/Common/Modal';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import type { OidcProvider } from '@server/lib/settings';
import {
  ErrorMessage,
  Field,
  Formik,
  useFormikContext,
  type FieldAttributes,
} from 'formik';
import { useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

const messages = defineMessages('settings.settings.SettingsOidc', {
  required: '{field} is required',
  url: '{field} must be a valid URL',
  addoidc: 'Add New OpenID Connect Provider',
  editoidc: 'Edit {name}',
  oidcDomain: 'Issuer URL',
  oidcDomainTip:
    "The base URL of the identity provider's OpenID Connect endpoint",
  oidcSlug: 'Provider Slug',
  oidcSlugTip: 'Unique identifier for the provider',
  oidcName: 'Provider Name',
  oidcNameTip: 'Name of the provider which appears on the login screen',
  oidcClientId: 'Client ID',
  oidcClientIdTip: 'The Client ID assigned to Jellyseerr',
  oidcClientSecret: 'Client Secret',
  oidcClientSecretTip: 'The Client Secret assigned to Jellyseerr',
  oidcLogo: 'Logo',
  oidcLogoTip:
    'The logo to display for the provider. Should be a URL or base64 encoded image',
  oidcScopes: 'Scopes',
  oidcScopesTip: 'Comma-separated list of scopes to request from the provider',
  oidcRequiredClaims: 'Required Claims',
  oidcRequiredClaimsTip:
    'Comma-separated list of boolean claims that are required to log in',
  oidcNewUserLogin: 'Allow New Users',
  oidcNewUserLoginTip:
    'Create accounts for new users logging in with this provider',
  saveSuccess: 'OpenID Connect provider saved successfully!',
  saveError: 'Failed to save OpenID Connect provider configuration',
});

interface EditOidcModalProps {
  show: boolean;
  provider?: OidcProvider;
  onClose: () => void;
  onOk: () => void;
}

function SlugField(props: FieldAttributes<unknown> & { readOnly?: boolean }) {
  const {
    values: { name },
    setFieldValue,
  } = useFormikContext<Partial<OidcProvider>>();

  useEffect(() => {
    if (!props.readOnly)
      setFieldValue(props.name, name?.toLowerCase().replace(/\s/g, '-'));
  }, [props.name, props.readOnly, name, setFieldValue]);

  return <Field {...props} />;
}

export default function EditOidcModal(props: EditOidcModalProps) {
  const intl = useIntl();
  const { addToast } = useToasts();

  const errorMessage = (
    field: keyof typeof messages,
    message: keyof typeof messages = 'required'
  ) =>
    intl.formatMessage(messages[message], {
      field: intl.formatMessage(messages[field]),
    });
  const oidcSettingsSchema = Yup.object().shape({
    slug: Yup.string().required(errorMessage('oidcSlug')),
    name: Yup.string().required(errorMessage('oidcName')),
    issuerUrl: Yup.string()
      .url(errorMessage('oidcDomain', 'url'))
      .required(errorMessage('oidcDomain')),
    clientId: Yup.string().required(errorMessage('oidcClientId')),
    clientSecret: Yup.string().required(errorMessage('oidcClientSecret')),
    logo: Yup.string(),
    requiredClaims: Yup.string(),
    scopes: Yup.string(),
    newUserLogin: Yup.boolean(),
  });

  const onSubmit = async ({ slug, ...provider }: OidcProvider) => {
    try {
      const res = await fetch(`/api/v1/settings/oidc/${slug}`, {
        method: 'PUT',
        body: JSON.stringify(provider),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 200) {
        addToast(intl.formatMessage(messages.saveSuccess), {
          appearance: 'success',
          autoDismiss: true,
        });

        props.onOk();
      } else {
        throw new Error(`Request failed with code ${res.status}`);
      }
    } catch (e) {
      addToast(intl.formatMessage(messages.saveError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  return (
    <Transition show={props.show}>
      <Formik
        initialValues={{
          slug: props.provider?.slug ?? '',
          name: props.provider?.name ?? '',
          issuerUrl: props.provider?.issuerUrl ?? '',
          clientId: props.provider?.clientId ?? '',
          clientSecret: props.provider?.clientSecret ?? '',
          logo: props.provider?.logo,
          requiredClaims: props.provider?.requiredClaims,
          scopes: props.provider?.scopes,
          newUserLogin: props.provider?.newUserLogin,
        }}
        validationSchema={oidcSettingsSchema}
        onSubmit={onSubmit}
      >
        {({ handleSubmit, isValid }) => (
          <Modal
            onCancel={props.onClose}
            cancelButtonProps={{ type: 'button' }}
            okButtonType="primary"
            okButtonProps={{ type: 'button' }}
            okDisabled={!isValid}
            onOk={() => handleSubmit()}
            okText={intl.formatMessage(globalMessages.save)}
            title={
              props.provider
                ? intl.formatMessage(messages.editoidc, {
                    name: props.provider.name,
                  })
                : intl.formatMessage(messages.addoidc)
            }
          >
            <div className="form-row">
              <label htmlFor="oidcName" className="text-label">
                {intl.formatMessage(messages.oidcName)}
                <span className="label-required">*</span>
                <span className="label-tip">
                  {intl.formatMessage(messages.oidcNameTip)}
                </span>
              </label>
              <div className="form-input-area">
                <Field id="oidcName" name="name" type="text" />
                <ErrorMessage className="error" component="span" name="name" />
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="oidcLogo" className="text-label">
                {intl.formatMessage(messages.oidcLogo)}
                <span className="label-tip">
                  {intl.formatMessage(messages.oidcLogoTip)}
                </span>
              </label>
              <div className="form-input-area">
                <div className="relative">
                  <Field
                    id="oidcLogo"
                    name="logo"
                    type="text"
                    className="pr-10"
                  />
                  <a
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-gray-200"
                    href="https://selfh.st/icons"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <MagnifyingGlassIcon className="h-4 w-4" />
                  </a>
                </div>
                <ErrorMessage className="error" component="span" name="logo" />
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="oidcDomain" className="text-label">
                {intl.formatMessage(messages.oidcDomain)}
                <span className="label-required">*</span>
                <span className="label-tip">
                  {intl.formatMessage(messages.oidcDomainTip)}
                </span>
              </label>
              <div className="form-input-area">
                <Field id="oidcDomain" name="issuerUrl" type="text" />
                <ErrorMessage
                  className="error"
                  component="span"
                  name="issuerUrl"
                />
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="oidcClientId" className="text-label">
                {intl.formatMessage(messages.oidcClientId)}
                <span className="label-required">*</span>
                <span className="label-tip">
                  {intl.formatMessage(messages.oidcClientIdTip)}
                </span>
              </label>
              <div className="form-input-area">
                <Field id="oidcClientId" name="clientId" type="text" />
                <ErrorMessage
                  className="error"
                  component="span"
                  name="clientId"
                />
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="oidcClientSecret" className="text-label">
                {intl.formatMessage(messages.oidcClientSecret)}
                <span className="label-required">*</span>
                <span className="label-tip">
                  {intl.formatMessage(messages.oidcClientSecretTip)}
                </span>
              </label>
              <div className="form-input-area">
                <div className="flex">
                  <SensitiveInput
                    id="oidcClientSecret"
                    name="clientSecret"
                    as="field"
                    autoComplete="new-password"
                  />
                </div>
                <ErrorMessage
                  className="error"
                  component="span"
                  name="clientSecret"
                />
              </div>
            </div>

            {/* Advanced Settings */}
            <Accordion>
              {({ openIndexes, AccordionContent, handleClick }) => (
                <>
                  <button
                    type="button"
                    onClick={() => handleClick(0)}
                    className="flex w-full items-center gap-0.5 py-4 font-bold text-gray-400"
                  >
                    <ChevronRightIcon
                      width={18}
                      className={twMerge(
                        'transition-transform',
                        openIndexes.includes(0) ? 'rotate-90' : ''
                      )}
                    />
                    Advanced Settings
                  </button>
                  <AccordionContent isOpen={openIndexes.includes(0)}>
                    <div className="form-row mt-0">
                      <label htmlFor="oidcSlug" className="text-label">
                        {intl.formatMessage(messages.oidcSlug)}
                        <span className="label-required">*</span>
                        <span className="label-tip">
                          {intl.formatMessage(messages.oidcSlugTip)}
                        </span>
                      </label>
                      <div className="form-input-area">
                        <SlugField
                          id="oidcSlug"
                          name="slug"
                          type="text"
                          // prevent editing of slug if editing an existing provider,
                          // to avoid invalidating existing linked accounts
                          readOnly={props.provider != null}
                          disabled={props.provider != null}
                          className={props.provider != null ? 'opacity-50' : ''}
                        />
                        <ErrorMessage
                          className="error"
                          component="span"
                          name="slug"
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <label htmlFor="oidcScopes" className="text-label">
                        {intl.formatMessage(messages.oidcScopes)}
                        <span className="label-tip">
                          {intl.formatMessage(messages.oidcScopesTip)}
                        </span>
                      </label>
                      <div className="form-input-area">
                        <Field id="oidcScopes" name="scopes" type="text" />
                        <ErrorMessage
                          className="error"
                          component="span"
                          name="scopes"
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <label
                        htmlFor="oidcRequiredClaims"
                        className="text-label"
                      >
                        {intl.formatMessage(messages.oidcRequiredClaims)}
                        <span className="label-tip">
                          {intl.formatMessage(messages.oidcRequiredClaimsTip)}
                        </span>
                      </label>
                      <div className="form-input-area">
                        <Field
                          id="oidcRequiredClaims"
                          name="requiredClaims"
                          type="text"
                        />
                        <ErrorMessage
                          className="error"
                          component="span"
                          name="requiredClaims"
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <label htmlFor="oidcNewUserLogin" className="text-label">
                        {intl.formatMessage(messages.oidcNewUserLogin)}
                        <span className="label-tip">
                          {intl.formatMessage(messages.oidcNewUserLoginTip)}
                        </span>
                      </label>
                      <div className="form-input-area">
                        <Field
                          id="oidcNewUserLogin"
                          name="newUserLogin"
                          type="checkbox"
                        />
                        <ErrorMessage
                          className="error"
                          component="span"
                          name="newUserLogin"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </>
              )}
            </Accordion>
          </Modal>
        )}
      </Formik>
    </Transition>
  );
}
