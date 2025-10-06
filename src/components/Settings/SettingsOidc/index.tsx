import Button from '@app/components/Common/Button';
import ConfirmButton from '@app/components/Common/ConfirmButton';
import Modal from '@app/components/Common/Modal';
import EditOidcModal from '@app/components/Settings/EditOidcModal';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/solid';
import type { OidcProvider, OidcSettings } from '@server/lib/settings';
import axios from 'axios';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

const messages = defineMessages('components.Settings.SettingsOidc', {
  configureoidc: 'Configure OpenID Connect',
  addOidcProvider: 'Add OpenID Connect Provider',
  oidcMatchUsername: 'Allow {mediaServerName} Usernames',
  oidcMatchUsernameTip:
    'Match OIDC users with their {mediaServerName} accounts by username',
  oidcAutomaticLogin: 'Automatic Login',
  oidcAutomaticLoginTip:
    'Automatically navigate to the OIDC login and logout pages. This functionality ' +
    'only supported when OIDC is the exclusive login method.',
  deleteError: 'Failed to delete OpenID Connect provider',
});

interface SettingsOidcProps {
  show: boolean;
  onOk?: () => void;
}

export default function SettingsOidc(props: SettingsOidcProps) {
  const { addToast } = useToasts();
  const intl = useIntl();
  const [editOidcModal, setEditOidcModal] = useState<{
    open: boolean;
    provider?: OidcProvider;
  }>({
    open: false,
    provider: undefined,
  });
  const { data, mutate: revalidate } = useSWR<OidcSettings>(
    '/api/v1/settings/oidc'
  );

  async function onDelete(provider: OidcProvider) {
    try {
      const response = await axios.delete<OidcSettings>(
        `/api/v1/settings/oidc/${provider.slug}`
      );
      revalidate(response.data);
    } catch (e) {
      addToast(intl.formatMessage(messages.deleteError), {
        autoDismiss: true,
        appearance: 'error',
      });
    }
  }

  return (
    <>
      <Transition show={props.show}>
        <Modal
          okText={intl.formatMessage(globalMessages.close)}
          onOk={props.onOk}
          okButtonProps={{ type: 'button' }}
          title={intl.formatMessage(messages.configureoidc)}
          backgroundClickable={false}
        >
          <ul className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {data?.providers.map((provider) => (
              <li
                className="col-span-1 flex flex-col justify-between rounded-lg bg-gray-700 shadow ring-1 ring-gray-500"
                key={provider.slug}
              >
                <div className="jusfity-between flex w-full items-center space-x-6 p-6">
                  <div className="flex-1 truncate">
                    <div className="mb-2 flex items-center space-x-2">
                      <h3 className="truncate text-lg font-bold leading-5 text-white">
                        {provider.name}
                      </h3>
                    </div>
                    <p className="mt-1 truncate text-sm leading-5 text-gray-300">
                      <span className="mr-2 font-bold">Issuer URL</span>
                      {provider.issuerUrl}
                    </p>
                    <p className="mt-1 truncate text-sm leading-5 text-gray-300">
                      <span className="mr-2 font-bold">Client ID</span>
                      {provider.clientId}
                    </p>
                  </div>

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={provider.logo || '/images/openid.svg'}
                    alt={provider.name}
                    className="h-10 w-10 flex-shrink-0"
                  />
                </div>

                <div className="border-t border-gray-500">
                  <div className="-mt-px flex">
                    <div className="flex w-0 flex-1 border-r border-gray-500">
                      <button
                        type="button"
                        onClick={() =>
                          setEditOidcModal({ open: true, provider })
                        }
                        className="focus:ring-blue relative -mr-px inline-flex w-0 flex-1 items-center justify-center rounded-bl-lg border border-transparent py-4 text-sm font-medium leading-5 text-gray-200 transition duration-150 ease-in-out hover:text-white focus:z-10 focus:border-gray-500 focus:outline-none"
                      >
                        <PencilIcon className="mr-2 h-5 w-5" />
                        <span>{intl.formatMessage(globalMessages.edit)}</span>
                      </button>
                    </div>
                    <div className="-ml-px flex w-0 flex-1">
                      <ConfirmButton
                        onClick={() => onDelete(provider)}
                        className="focus:ring-blue relative inline-flex w-0 flex-1 items-center justify-center rounded-none rounded-br-lg border border-transparent py-4 text-sm font-medium leading-5 text-gray-200 transition duration-150 ease-in-out hover:text-white focus:z-10 focus:border-gray-500 focus:outline-none"
                        confirmText={intl.formatMessage(
                          globalMessages.areyousure
                        )}
                      >
                        <TrashIcon className="mr-2 h-5 w-5" />
                        <span>{intl.formatMessage(globalMessages.delete)}</span>
                      </ConfirmButton>
                    </div>
                  </div>
                </div>
              </li>
            ))}

            <li className="col-span-1 h-32 rounded-lg border-2 border-dashed border-gray-400 shadow sm:h-44">
              <div className="flex h-full w-full items-center justify-center">
                <Button
                  type="button"
                  buttonType="ghost"
                  className="mt-3 mb-3"
                  onClick={() => setEditOidcModal({ open: true })}
                >
                  <PlusIcon />
                  <span>{intl.formatMessage(messages.addOidcProvider)}</span>
                </Button>
              </div>
            </li>
          </ul>
        </Modal>
      </Transition>

      <EditOidcModal
        show={editOidcModal.open}
        provider={editOidcModal.provider}
        onClose={() => setEditOidcModal((prev) => ({ ...prev, open: false }))}
        onOk={() => {
          revalidate();
          // preserve the provider so that it doesn't disappear while the dialog is closing
          setEditOidcModal((prev) => ({ ...prev, open: false }));
        }}
      />
    </>
  );
}
