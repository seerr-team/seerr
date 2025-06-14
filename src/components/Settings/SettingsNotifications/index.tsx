import DiscordLogo from '@app/assets/extlogos/discord.svg';
import GotifyLogo from '@app/assets/extlogos/gotify.svg';
import NtfyLogo from '@app/assets/extlogos/ntfy.svg';
import PushbulletLogo from '@app/assets/extlogos/pushbullet.svg';
import PushoverLogo from '@app/assets/extlogos/pushover.svg';
import SlackLogo from '@app/assets/extlogos/slack.svg';
import TelegramLogo from '@app/assets/extlogos/telegram.svg';
import Button from '@app/components/Common/Button';
import Dropdown from '@app/components/Common/Dropdown';
import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import Table from '@app/components/Common/Table';
import ToggleSwitch from '@app/components/Common/ToggleSwitch';
import NotificationModal, {
  NotificationModalType,
} from '@app/components/Settings/SettingsNotifications/NotificationModal';
import { useUpdateQueryParams } from '@app/hooks/useUpdateQueryParams';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import {
  BarsArrowDownIcon,
  BeakerIcon,
  BoltIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloudIcon,
  EnvelopeIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/solid';
import type { NotificationSettingsResultResponse } from '@server/interfaces/api/settingsInterfaces';
import type { NotificationAgentConfig } from '@server/interfaces/settings';
import axios from 'axios';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

const messages = defineMessages('components.Settings.SettingsNotifications', {
  notifications: 'Notifications',
  notificationInstanceList: 'Notification Instance List',
  createNotificationInstance: 'Create Notification Instance',
  instanceName: 'Name',
  instanceId: 'ID',
  notificationAgent: 'Agent',
  instanceEnabled: 'Enabled',
  instanceDefault: 'Default',
  instanceDeleted: 'Notification instance deleted successfully!',
  instanceDeleteError:
    'Something went wrong while deleting the notification instance.',
  toastTestSending: 'Sending test notification…',
  toastTestSuccess: 'Test notification sent!',
  toastTestFailed: 'Test notification failed to send.',
  toastEnabledToggleSuccess:
    'Notification instance enabled toggled successfully!',
  toastEnabledToggleFailed: 'Notification instance failed to toggle enabled!',
  toastDefaultToggleSuccess:
    'Notification instance default toggled successfully!',
  toastDefaultToggleFailed: 'Notification instance failed to toggle default!',
});

enum Sort {
  ID = 'id',
  NAME = 'name',
  AGENT = 'agent',
}

const SettingsNotifications = () => {
  const intl = useIntl();
  const router = useRouter();
  const { addToast, removeToast } = useToasts();
  const [currentSort, setCurrentSort] = useState<Sort>(Sort.ID);
  const [currentPageSize, setCurrentPageSize] = useState<number>(10);
  const [notificationModal, setNotificationModal] = useState<{
    open: boolean;
    type: NotificationModalType;
    instance?: NotificationAgentConfig;
  }>({
    open: false,
    type: NotificationModalType.EDIT,
  });

  const page = router.query.page ? Number(router.query.page) : 1;
  const pageIndex = page - 1;
  const updateQueryParams = useUpdateQueryParams({ page: page.toString() });

  const { data, mutate: revalidate } =
    useSWR<NotificationSettingsResultResponse>(
      `/api/v1/settings/notification?take=${currentPageSize}&skip=${
        pageIndex * currentPageSize
      }&sort=${currentSort}`
    );

  useEffect(() => {
    const filterString = window.localStorage.getItem('nl-filter-settings');

    if (filterString) {
      const filterSettings = JSON.parse(filterString);

      setCurrentSort(filterSettings.currentSort);
      setCurrentPageSize(filterSettings.currentPageSize);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      'nl-filter-settings',
      JSON.stringify({
        currentSort,
        currentPageSize,
      })
    );
  }, [currentSort, currentPageSize]);

  const deleteInstance = async (instanceId: number) => {
    try {
      await axios.delete(`/api/v1/settings/notification/${instanceId}`);

      addToast(intl.formatMessage(messages.instanceDeleted), {
        autoDismiss: true,
        appearance: 'success',
      });
    } catch (e) {
      addToast(intl.formatMessage(messages.instanceDeleteError), {
        autoDismiss: true,
        appearance: 'error',
      });
    } finally {
      revalidate();
    }
  };

  const testInstance = async (instanceIndex: number) => {
    let toastId: string | undefined;
    try {
      addToast(
        intl.formatMessage(messages.toastTestSending),
        {
          autoDismiss: false,
          appearance: 'info',
        },
        (id) => {
          toastId = id;
        }
      );
      await axios.post(
        '/api/v1/settings/notification/test',
        data?.results[instanceIndex]
      );

      if (toastId) {
        removeToast(toastId);
      }
      addToast(intl.formatMessage(messages.toastTestSuccess), {
        autoDismiss: true,
        appearance: 'success',
      });
    } catch (e) {
      if (toastId) {
        removeToast(toastId);
      }
      addToast(intl.formatMessage(messages.toastTestFailed), {
        autoDismiss: true,
        appearance: 'error',
      });
    }
  };

  const toggleInstanceEnabled = async (instance: NotificationAgentConfig) => {
    instance.enabled = !instance.enabled;

    if (!instance.enabled) {
      instance.default = false;
    }

    try {
      await axios.post(
        `/api/v1/settings/notification/${instance.id}`,
        instance
      );

      addToast(intl.formatMessage(messages.toastEnabledToggleSuccess), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (e) {
      addToast(intl.formatMessage(messages.toastEnabledToggleFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      revalidate();
    }
  };

  const toggleInstanceDefault = async (instance: NotificationAgentConfig) => {
    const currentDefault = data?.results.find(
      (result) =>
        result.agent === instance.agent &&
        result.default &&
        result.id !== instance.id
    );

    if (currentDefault) {
      return;
    }

    instance.default = !instance.default;

    try {
      await axios.post(
        `/api/v1/settings/notification/${instance.id}`,
        instance
      );

      addToast(intl.formatMessage(messages.toastDefaultToggleSuccess), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (e) {
      addToast(intl.formatMessage(messages.toastDefaultToggleFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      revalidate();
    }
  };

  if (!data) {
    return <LoadingSpinner />;
  }

  const hasNextPage = data.pageInfo.pages > pageIndex + 1;
  const hasPrevPage = pageIndex > 0;

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.notifications),
          intl.formatMessage(globalMessages.settings),
        ]}
      />

      {notificationModal.open && (
        <Transition
          as="div"
          enter="transition-opacity duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          show={notificationModal.open}
        >
          <NotificationModal
            type={notificationModal.type}
            data={notificationModal.instance}
            afterSave={() => {
              revalidate();
              setNotificationModal({
                open: false,
                type: NotificationModalType.EDIT,
              });
            }}
            onClose={() => {
              setNotificationModal({
                open: false,
                type: NotificationModalType.EDIT,
              });
            }}
          />
        </Transition>
      )}

      <div className="flex flex-col justify-between lg:flex-row lg:items-end">
        <Header>{intl.formatMessage(messages.notificationInstanceList)}</Header>
        <div className="mt-2 flex flex-grow flex-col lg:flex-grow-0 lg:flex-row">
          <div className="mb-2 flex-grow justify-between sm:mr-2 sm:flex-row lg:mb-0 lg:flex-grow-0">
            <Dropdown
              className="mb-2 flex-grow sm:mb-0"
              buttonType="ghost"
              text={
                <>
                  <PlusIcon />
                  {intl.formatMessage(messages.createNotificationInstance)}
                </>
              }
            >
              <Dropdown.Item
                onClick={() =>
                  setNotificationModal({
                    open: true,
                    instance: data.agentTemplates.discord,
                    type: NotificationModalType.CREATE,
                  })
                }
              >
                <DiscordLogo />
                <span>Discord</span>
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() =>
                  setNotificationModal({
                    open: true,
                    instance: data.agentTemplates.email,
                    type: NotificationModalType.CREATE,
                  })
                }
              >
                <EnvelopeIcon />
                <span>Email</span>
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() =>
                  setNotificationModal({
                    open: true,
                    instance: data.agentTemplates.gotify,
                    type: NotificationModalType.CREATE,
                  })
                }
              >
                <GotifyLogo />
                <span>Gotify</span>
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() =>
                  setNotificationModal({
                    open: true,
                    instance: data.agentTemplates.ntfy,
                    type: NotificationModalType.CREATE,
                  })
                }
              >
                <NtfyLogo />
                <span>Ntfy</span>
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() =>
                  setNotificationModal({
                    open: true,
                    instance: data.agentTemplates.pushbullet,
                    type: NotificationModalType.CREATE,
                  })
                }
              >
                <PushbulletLogo />
                <span>Pushbullet</span>
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() =>
                  setNotificationModal({
                    open: true,
                    instance: data.agentTemplates.pushover,
                    type: NotificationModalType.CREATE,
                  })
                }
              >
                <PushoverLogo />
                <span>Pushover</span>
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() =>
                  setNotificationModal({
                    open: true,
                    instance: data.agentTemplates.slack,
                    type: NotificationModalType.CREATE,
                  })
                }
              >
                <SlackLogo />
                <span>Slack</span>
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() =>
                  setNotificationModal({
                    open: true,
                    instance: data.agentTemplates.telegram,
                    type: NotificationModalType.CREATE,
                  })
                }
              >
                <TelegramLogo />
                <span>Telegram</span>
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() =>
                  setNotificationModal({
                    open: true,
                    instance: data.agentTemplates.webhook,
                    type: NotificationModalType.CREATE,
                  })
                }
              >
                <BoltIcon />
                <span>Webhook</span>
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() =>
                  setNotificationModal({
                    open: true,
                    instance: data.agentTemplates.webpush,
                    type: NotificationModalType.CREATE,
                  })
                }
              >
                <CloudIcon />
                <span>WebPush</span>
              </Dropdown.Item>
            </Dropdown>
          </div>
          <div className="mb-2 flex flex-grow lg:mb-0 lg:flex-grow-0">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
              <BarsArrowDownIcon className="h-6 w-6" />
            </span>
            <select
              id="sort"
              name="sort"
              onChange={(e) => {
                setCurrentSort(e.target.value as Sort);
                router.push(router.pathname);
              }}
              value={currentSort}
              className="rounded-r-only"
            >
              <option value="id">
                {intl.formatMessage(messages.instanceId)}
              </option>
              <option value="name">
                {intl.formatMessage(messages.instanceName)}
              </option>
              <option value="agent">
                {intl.formatMessage(messages.notificationAgent)}
              </option>
            </select>
          </div>
        </div>
      </div>

      <Table>
        <thead>
          <tr>
            <Table.TH>{intl.formatMessage(messages.instanceName)}</Table.TH>
            <Table.TH>{intl.formatMessage(messages.instanceId)}</Table.TH>
            <Table.TH>
              {intl.formatMessage(messages.notificationAgent)}
            </Table.TH>
            <Table.TH>{intl.formatMessage(messages.instanceEnabled)}</Table.TH>
            <Table.TH>{intl.formatMessage(messages.instanceDefault)}</Table.TH>
            <Table.TH></Table.TH>
          </tr>
        </thead>

        <Table.TBody>
          {data.results.map((instance, instanceIndex) => (
            <tr
              key={`notification-instance-list-${instance.id}`}
              data-testid="notification-instance-list-row"
            >
              <Table.TD>{instance.name}</Table.TD>
              <Table.TD>{instance.id}</Table.TD>
              <Table.TD>{instance.agent}</Table.TD>
              <Table.TD>
                <ToggleSwitch
                  isToggled={instance.enabled}
                  onToggle={() => toggleInstanceEnabled(instance)}
                  highContrast
                />
              </Table.TD>
              <Table.TD>
                <input
                  type="checkbox"
                  onClick={() => {
                    toggleInstanceDefault(instance);
                  }}
                  disabled={
                    !instance.enabled ||
                    data.results.findIndex(
                      (result) =>
                        result.agent === instance.agent &&
                        result.default &&
                        result.id !== instance.id
                    ) !== -1
                  }
                  checked={instance.default}
                />
              </Table.TD>
              <Table.TD className="flex flex-row-reverse">
                <Button
                  buttonType="danger"
                  onClick={() => deleteInstance(instance.id)}
                >
                  <TrashIcon />
                  <span>{intl.formatMessage(globalMessages.delete)}</span>
                </Button>
                <Button
                  buttonType="warning"
                  className="mr-2"
                  onClick={() =>
                    setNotificationModal({
                      open: true,
                      instance: instance,
                      type: NotificationModalType.EDIT,
                    })
                  }
                >
                  <PencilIcon />
                  <span>{intl.formatMessage(globalMessages.edit)}</span>
                </Button>
                <Button
                  buttonType="warning"
                  className="mr-4"
                  onClick={(e) => {
                    e.preventDefault();
                    testInstance(instanceIndex);
                  }}
                >
                  <BeakerIcon />
                  <span>{intl.formatMessage(globalMessages.test)}</span>
                </Button>
              </Table.TD>
            </tr>
          ))}
          <tr className="bg-gray-700">
            <Table.TD colSpan={8} noPadding>
              <nav
                className="flex w-screen flex-col items-center space-x-4 space-y-3 px-6 py-3 sm:flex-row sm:space-y-0 lg:w-full"
                aria-label="Pagination"
              >
                <div className="hidden lg:flex lg:flex-1">
                  <p className="text-sm">
                    {data.results.length > 0 &&
                      intl.formatMessage(globalMessages.showingresults, {
                        from: pageIndex * currentPageSize + 1,
                        to:
                          data.results.length < currentPageSize
                            ? pageIndex * currentPageSize + data.results.length
                            : (pageIndex + 1) * currentPageSize,
                        total: data.pageInfo.results,
                        strong: (msg: React.ReactNode) => (
                          <span className="font-medium">{msg}</span>
                        ),
                      })}
                  </p>
                </div>
                <div className="flex justify-center sm:flex-1 sm:justify-start lg:justify-center">
                  <span className="-mt-3 items-center text-sm sm:-ml-4 sm:mt-0 lg:ml-0">
                    {intl.formatMessage(globalMessages.resultsperpage, {
                      pageSize: (
                        <select
                          id="pageSize"
                          name="pageSize"
                          onChange={(e) => {
                            setCurrentPageSize(Number(e.target.value));
                            router
                              .push(router.pathname)
                              .then(() => window.scrollTo(0, 0));
                          }}
                          value={currentPageSize}
                          className="short inline"
                        >
                          <option value="5">5</option>
                          <option value="10">10</option>
                          <option value="25">25</option>
                          <option value="50">50</option>
                          <option value="100">100</option>
                        </select>
                      ),
                    })}
                  </span>
                </div>
                <div className="flex flex-auto justify-center space-x-2 sm:flex-1 sm:justify-end">
                  <Button
                    disabled={!hasPrevPage}
                    onClick={() =>
                      updateQueryParams('page', (page - 1).toString())
                    }
                  >
                    <ChevronLeftIcon />
                    <span>{intl.formatMessage(globalMessages.previous)}</span>
                  </Button>
                  <Button
                    disabled={!hasNextPage}
                    onClick={() =>
                      updateQueryParams('page', (page + 1).toString())
                    }
                  >
                    <span>{intl.formatMessage(globalMessages.next)}</span>
                    <ChevronRightIcon />
                  </Button>
                </div>
              </nav>
            </Table.TD>
          </tr>
        </Table.TBody>
      </Table>
    </>
  );
};

export default SettingsNotifications;
