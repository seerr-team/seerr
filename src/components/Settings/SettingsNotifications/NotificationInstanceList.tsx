import Button from '@app/components/Common/Button';
import Table from '@app/components/Common/Table';
import ToggleSwitch from '@app/components/Common/ToggleSwitch';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import {
  BeakerIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/solid';
import type { NotificationAgentConfig } from '@server/interfaces/settings';
import axios from 'axios';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';

const messages = defineMessages(
  'components.Settings.SettingsNotifications.NotificationInstanceList',
  {
    noNotificationInstances: 'No Notification Instances existing yet.',
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
  }
);

interface NotificationInstanceListProps {
  instances: NotificationAgentConfig[];
  revalidateInstances: () => void;
  onEdit: (instance: NotificationAgentConfig) => void;
  currentPageIndex: number;
  currentPageSize: number;
  setCurrentPageSize: (pageSize: number) => void;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  updateQueryParams: (key: string, value?: string | undefined) => void;
  totalItemsSize: number;
}

function NotificationInstanceList({
  instances,
  revalidateInstances,
  onEdit,
  currentPageIndex,
  currentPageSize,
  setCurrentPageSize,
  hasPrevPage,
  hasNextPage,
  updateQueryParams,
  totalItemsSize: totalSize,
}: NotificationInstanceListProps) {
  const intl = useIntl();
  const router = useRouter();
  const { addToast, removeToast } = useToasts();

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
      revalidateInstances();
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
        instances[instanceIndex]
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
      revalidateInstances();
    }
  };

  const toggleInstanceDefault = async (instance: NotificationAgentConfig) => {
    const currentDefault = instances.find(
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
      revalidateInstances();
    }
  };

  if (!instances.length) {
    return (
      <p className="mt-4">
        {intl.formatMessage(messages.noNotificationInstances)}
      </p>
    );
  }

  return (
    <Table>
      <thead>
        <tr>
          <Table.TH>{intl.formatMessage(messages.instanceName)}</Table.TH>
          <Table.TH>{intl.formatMessage(messages.instanceId)}</Table.TH>
          <Table.TH>{intl.formatMessage(messages.notificationAgent)}</Table.TH>
          <Table.TH>{intl.formatMessage(messages.instanceEnabled)}</Table.TH>
          <Table.TH>{intl.formatMessage(messages.instanceDefault)}</Table.TH>
          <Table.TH></Table.TH>
        </tr>
      </thead>

      <Table.TBody>
        {instances.map((instance, instanceIndex) => (
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
                  instances.findIndex(
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
                onClick={() => onEdit(instance)}
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
                  {instances.length > 0 &&
                    intl.formatMessage(globalMessages.showingresults, {
                      from: currentPageIndex * currentPageSize + 1,
                      to:
                        instances.length < currentPageSize
                          ? currentPageIndex * currentPageSize +
                            instances.length
                          : (currentPageIndex + 1) * currentPageSize,
                      total: totalSize,
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
                    updateQueryParams('page', (currentPageIndex - 1).toString())
                  }
                >
                  <ChevronLeftIcon />
                  <span>{intl.formatMessage(globalMessages.previous)}</span>
                </Button>
                <Button
                  disabled={!hasNextPage}
                  onClick={() =>
                    updateQueryParams('page', (currentPageIndex + 1).toString())
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
  );
}

export default NotificationInstanceList;
