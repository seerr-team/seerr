import RadarrLogo from '@app/assets/services/radarr.svg';
import SonarrLogo from '@app/assets/services/sonarr.svg';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import PageTitle from '@app/components/Common/PageTitle';
import RadarrModal from '@app/components/Settings/RadarrModal';
import RoutingRuleList from '@app/components/Settings/RoutingRule/RoutingRuleList';
import RoutingRuleModal from '@app/components/Settings/RoutingRule/RoutingRuleModal';
import type { RoutingRule } from '@app/components/Settings/RoutingRule/types';
import SonarrModal from '@app/components/Settings/SonarrModal';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/solid';
import type { RadarrSettings, SonarrSettings } from '@server/lib/settings';
import axios from 'axios';
import { Fragment, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR, { mutate } from 'swr';

const messages = defineMessages('components.Settings', {
  services: 'Services',
  instances: 'Instances',
  instancesDescription:
    'Configure your Sonarr and Radarr server connections below. Routing rules determine which instance handles each request.',
  deleteserverconfirm: 'Are you sure you want to delete this server?',
  ssl: 'SSL',
  default: 'Default',
  default4k: 'Default 4K',
  is4k: '4K',
  address: 'Address',
  routingRules: 'Routing Rules',
  noRules: 'No routing rules configured',
  ruleCount: '{count} routing {count, plural, one {rule} other {rules}}',
  addInstance: 'Add Instance',
  addRadarr: 'Add Radarr',
  addSonarr: 'Add Sonarr',
  deleteServer: 'Delete {serverType} Server',
});

interface ServerInstanceProps {
  name: string;
  isDefault?: boolean;
  is4k?: boolean;
  hostname: string;
  port: number;
  isSSL?: boolean;
  externalUrl?: string;
  ruleCount: number;
  isSonarr?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export interface DVRTestResponse {
  profiles: {
    id: number;
    name: string;
  }[];
  rootFolders: {
    id: number;
    path: string;
  }[];
  tags: {
    id: number;
    label: string;
  }[];
  urlBase?: string;
}

export type RadarrTestResponse = DVRTestResponse;

export type SonarrTestResponse = DVRTestResponse & {
  languageProfiles:
    | {
        id: number;
        name: string;
      }[]
    | null;
};

const ServerInstance = ({
  name,
  hostname,
  port,
  isDefault = false,
  is4k = false,
  isSSL = false,
  isSonarr = false,
  ruleCount,
  externalUrl,
  onEdit,
  onDelete,
}: ServerInstanceProps) => {
  const intl = useIntl();

  const internalUrl =
    (isSSL ? 'https://' : 'http://') + hostname + ':' + String(port);
  const serviceUrl = externalUrl ?? internalUrl;

  return (
    <li className="col-span-1 rounded-lg bg-gray-800 shadow ring-1 ring-gray-500">
      <div className="flex w-full items-center justify-between space-x-6 p-6">
        <div className="flex-1 truncate">
          <div className="mb-2 flex items-center space-x-2">
            <h3 className="truncate font-medium leading-5 text-white">
              <a
                href={serviceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="transition duration-300 hover:text-white hover:underline"
              >
                {name}
              </a>
            </h3>
            {isDefault && !is4k && (
              <Badge>{intl.formatMessage(messages.default)}</Badge>
            )}
            {isDefault && is4k && (
              <Badge>{intl.formatMessage(messages.default4k)}</Badge>
            )}
            {!isDefault && is4k && (
              <Badge badgeType="warning">
                {intl.formatMessage(messages.is4k)}
              </Badge>
            )}
            {isSSL && (
              <Badge badgeType="success">
                {intl.formatMessage(messages.ssl)}
              </Badge>
            )}
          </div>
          <p className="mt-1 truncate text-sm leading-5 text-gray-300">
            <span className="mr-2 font-bold">
              {intl.formatMessage(messages.address)}
            </span>
            <a
              href={internalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="transition duration-300 hover:text-white hover:underline"
            >
              {internalUrl}
            </a>
          </p>
          <p className="mt-1 truncate text-sm leading-5 text-gray-300">
            <span className="mr-2 font-bold">
              {intl.formatMessage(messages.routingRules)}
            </span>
            {ruleCount === 0
              ? intl.formatMessage(messages.noRules)
              : intl.formatMessage(messages.ruleCount, { count: ruleCount })}
          </p>
        </div>
        <a
          href={serviceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-50 hover:opacity-100"
        >
          {isSonarr ? (
            <SonarrLogo className="h-10 w-10 flex-shrink-0" />
          ) : (
            <RadarrLogo className="h-10 w-10 flex-shrink-0" />
          )}
        </a>
      </div>
      <div className="border-t border-gray-500">
        <div className="-mt-px flex">
          <div className="flex w-0 flex-1 border-r border-gray-500">
            <button
              onClick={() => onEdit()}
              className="focus:ring-blue relative -mr-px inline-flex w-0 flex-1 items-center justify-center rounded-bl-lg border border-transparent py-4 text-sm font-medium leading-5 text-gray-200 transition duration-150 ease-in-out hover:text-white focus:z-10 focus:border-gray-500 focus:outline-none"
            >
              <PencilIcon className="mr-2 h-5 w-5" />
              <span>{intl.formatMessage(globalMessages.edit)}</span>
            </button>
          </div>
          <div className="-ml-px flex w-0 flex-1">
            <button
              onClick={() => onDelete()}
              className="focus:ring-blue relative inline-flex w-0 flex-1 items-center justify-center rounded-br-lg border border-transparent py-4 text-sm font-medium leading-5 text-gray-200 transition duration-150 ease-in-out hover:text-white focus:z-10 focus:border-gray-500 focus:outline-none"
            >
              <TrashIcon className="mr-2 h-5 w-5" />
              <span>{intl.formatMessage(globalMessages.delete)}</span>
            </button>
          </div>
        </div>
      </div>
    </li>
  );
};

const SettingsServices = () => {
  const intl = useIntl();
  const {
    data: radarrData,
    error: radarrError,
    mutate: revalidateRadarr,
  } = useSWR<RadarrSettings[]>('/api/v1/settings/radarr');
  const {
    data: sonarrData,
    error: sonarrError,
    mutate: revalidateSonarr,
  } = useSWR<SonarrSettings[]>('/api/v1/settings/sonarr');
  const { data: routingRules, mutate: revalidateRules } = useSWR<RoutingRule[]>(
    '/api/v1/routingRule'
  );

  const [editRadarrModal, setEditRadarrModal] = useState<{
    open: boolean;
    radarr: RadarrSettings | null;
  }>({
    open: false,
    radarr: null,
  });
  const [editSonarrModal, setEditSonarrModal] = useState<{
    open: boolean;
    sonarr: SonarrSettings | null;
  }>({
    open: false,
    sonarr: null,
  });
  const [deleteServerModal, setDeleteServerModal] = useState<{
    open: boolean;
    type: 'radarr' | 'sonarr';
    serverId: number | null;
  }>({
    open: false,
    type: 'radarr',
    serverId: null,
  });
  const [routingRuleModal, setRoutingRuleModal] = useState<{
    open: boolean;
    rule: RoutingRule | null;
    prefillData?: Partial<RoutingRule>;
  }>({
    open: false,
    rule: null,
  });

  const deleteServer = async () => {
    await axios.delete(
      `/api/v1/settings/${deleteServerModal.type}/${deleteServerModal.serverId}`
    );
    setDeleteServerModal({ open: false, serverId: null, type: 'radarr' });
    revalidateRadarr();
    revalidateSonarr();
    mutate('/api/v1/settings/public');
    revalidateRules();
  };

  const handleRadarrSave = async (savedInstance: RadarrSettings) => {
    setEditRadarrModal({ open: false, radarr: null });
    revalidateRadarr();
    mutate('/api/v1/settings/public');

    if (!savedInstance.isDefault) return;

    const rules = (await revalidateRules()) ?? [];

    const existingDefault = rules.find(
      (r) =>
        r.serviceType === 'radarr' &&
        r.is4k === savedInstance.is4k &&
        r.isFallback
    );

    setRoutingRuleModal({
      open: true,
      rule: existingDefault
        ? { ...existingDefault, targetServiceId: savedInstance.id }
        : null,
      prefillData: existingDefault
        ? undefined
        : {
            name: `${savedInstance.name} Default Route`,
            serviceType: 'radarr',
            is4k: savedInstance.is4k,
            targetServiceId: savedInstance.id,
            isFallback: true,
          },
    });
  };

  const handleSonarrSave = async (savedInstance: SonarrSettings) => {
    setEditSonarrModal({ open: false, sonarr: null });
    revalidateSonarr();
    mutate('/api/v1/settings/public');

    if (!savedInstance.isDefault) return;

    const rules = (await revalidateRules()) ?? [];

    const existingDefault = rules.find(
      (r) =>
        r.serviceType === 'sonarr' &&
        r.is4k === savedInstance.is4k &&
        r.isFallback
    );

    setRoutingRuleModal({
      open: true,
      rule: existingDefault
        ? { ...existingDefault, targetServiceId: savedInstance.id }
        : null,
      prefillData: existingDefault
        ? undefined
        : {
            name: `${savedInstance.name} Default Route`,
            serviceType: 'sonarr',
            is4k: savedInstance.is4k,
            targetServiceId: savedInstance.id,
            isFallback: true,
          },
    });
  };

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.services),
          intl.formatMessage(globalMessages.settings),
        ]}
      />

      {editRadarrModal.open && (
        <RadarrModal
          radarr={editRadarrModal.radarr}
          onClose={() => setEditRadarrModal({ open: false, radarr: null })}
          onSave={handleRadarrSave}
        />
      )}
      {editSonarrModal.open && (
        <SonarrModal
          sonarr={editSonarrModal.sonarr}
          onClose={() => setEditSonarrModal({ open: false, sonarr: null })}
          onSave={handleSonarrSave}
        />
      )}

      <Transition
        as={Fragment}
        show={deleteServerModal.open}
        enter="transition-opacity ease-in-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity ease-in-out duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <Modal
          okText={intl.formatMessage(globalMessages.delete)}
          okButtonType="danger"
          onOk={() => deleteServer()}
          onCancel={() =>
            setDeleteServerModal({
              open: false,
              serverId: null,
              type: 'radarr',
            })
          }
          title={intl.formatMessage(messages.deleteServer, {
            serverType:
              deleteServerModal.type === 'radarr' ? 'Radarr' : 'Sonarr',
          })}
        >
          {intl.formatMessage(messages.deleteserverconfirm)}
        </Modal>
      </Transition>

      {routingRuleModal.open && radarrData && sonarrData && (
        <RoutingRuleModal
          rule={routingRuleModal.rule}
          onClose={() => {
            setRoutingRuleModal({ open: false, rule: null });
            revalidateRules();
          }}
          radarrServices={radarrData}
          sonarrServices={sonarrData}
          prefillData={routingRuleModal.prefillData}
        />
      )}

      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.instances)}</h3>
        <p className="description">
          {intl.formatMessage(messages.instancesDescription)}
        </p>
      </div>

      <div className="section">
        {(!radarrData && !radarrError) || (!sonarrData && !sonarrError) ? (
          <LoadingSpinner />
        ) : (
          <ul className="grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {radarrData?.map((radarr) => (
              <ServerInstance
                key={`radarr-config-${radarr.id}`}
                name={radarr.name}
                isDefault={radarr.isDefault}
                hostname={radarr.hostname}
                port={radarr.port}
                ruleCount={
                  routingRules?.filter(
                    (r) =>
                      r.serviceType === 'radarr' &&
                      r.targetServiceId === radarr.id
                  ).length ?? 0
                }
                isSSL={radarr.useSsl}
                is4k={radarr.is4k}
                externalUrl={radarr.externalUrl}
                onEdit={() => setEditRadarrModal({ open: true, radarr })}
                onDelete={() =>
                  setDeleteServerModal({
                    open: true,
                    serverId: radarr.id,
                    type: 'radarr',
                  })
                }
              />
            ))}

            {sonarrData?.map((sonarr) => (
              <ServerInstance
                key={`sonarr-config-${sonarr.id}`}
                name={sonarr.name}
                isDefault={sonarr.isDefault}
                hostname={sonarr.hostname}
                port={sonarr.port}
                ruleCount={
                  routingRules?.filter(
                    (r) =>
                      r.serviceType === 'sonarr' &&
                      r.targetServiceId === sonarr.id
                  ).length ?? 0
                }
                isSSL={sonarr.useSsl}
                isSonarr
                is4k={sonarr.is4k}
                externalUrl={sonarr.externalUrl}
                onEdit={() => setEditSonarrModal({ open: true, sonarr })}
                onDelete={() =>
                  setDeleteServerModal({
                    open: true,
                    serverId: sonarr.id,
                    type: 'sonarr',
                  })
                }
              />
            ))}

            <li className="col-span-1 h-32 rounded-lg border-2 border-dashed border-gray-400 shadow sm:h-44">
              <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                <Button
                  buttonType="ghost"
                  onClick={() =>
                    setEditRadarrModal({ open: true, radarr: null })
                  }
                >
                  <PlusIcon />
                  <span>{intl.formatMessage(messages.addRadarr)}</span>
                </Button>
                <Button
                  buttonType="ghost"
                  onClick={() =>
                    setEditSonarrModal({ open: true, sonarr: null })
                  }
                >
                  <PlusIcon />
                  <span>{intl.formatMessage(messages.addSonarr)}</span>
                </Button>
              </div>
            </li>
          </ul>
        )}
      </div>
      <div className="mt-10">
        {radarrData && sonarrData && routingRules && (
          <RoutingRuleList
            rules={routingRules}
            radarrServices={radarrData}
            sonarrServices={sonarrData}
            onAddRule={(prefillData) =>
              setRoutingRuleModal({ open: true, rule: null, prefillData })
            }
            onEditRule={(rule) => setRoutingRuleModal({ open: true, rule })}
            revalidate={revalidateRules}
          />
        )}
      </div>
    </>
  );
};

export default SettingsServices;
