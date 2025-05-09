import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import Table from '@app/components/Common/Table';
import { useUpdateQueryParams } from '@app/hooks/useUpdateQueryParams';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import {
  BarsArrowDownIcon,
  BeakerIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/solid';
import type { NotificationSettingsResultResponse } from '@server/interfaces/api/settingsInterfaces';
import axios from 'axios';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

const messages = defineMessages('components.Settings', {
  notifications: 'Notifications',
  notificationInstanceList: 'Notification Instance List',
  instanceName: 'Name',
  instanceId: 'ID',
  notificationAgent: 'Agent',
  instanceDeleted: 'Notification instance deleted successfully!',
  instanceDeleteError:
    'Something went wrong while deleting the notification instance.',
  toastTestSending: 'Sending test notification…',
  toastTestSuccess: 'Test notification sent!',
  toastTestFailed: 'Test notification failed to send.',
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
  const [selectedInstances, setSelectedInstances] = useState<number[]>([]);

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

  const isAllInstancesSelected = () =>
    selectedInstances.length === data?.results.length;
  const isInstanceSelected = (instanceId: number) =>
    selectedInstances.includes(instanceId);

  const toggleAllInstances = () => {
    if (
      data &&
      selectedInstances.length >= 0 &&
      selectedInstances.length < data.results.length - 1
    ) {
      setSelectedInstances(data.results.map((instance) => instance.id));
    } else {
      setSelectedInstances([]);
    }
  };

  const toggleInstance = (instanceId: number) => {
    if (selectedInstances.includes(instanceId)) {
      setSelectedInstances((instances) =>
        instances.filter((u) => u !== instanceId)
      );
    } else {
      setSelectedInstances((instances) => [...instances, instanceId]);
    }
  };

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

  const testInstance = async (instanceId: number) => {
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
        data?.results[instanceId]
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

      <div className="flex flex-col justify-between lg:flex-row lg:items-end">
        <Header>{intl.formatMessage(messages.notificationInstanceList)}</Header>
        <div className="mt-2 flex flex-grow flex-col lg:flex-grow-0 lg:flex-row">
          <div className="mb-2 flex flex-grow flex-col justify-between sm:flex-row lg:mb-0 lg:flex-grow-0">
            {/*<Button
                className="mb-2 flex-grow sm:mb-0 sm:mr-2"
                buttonType="primary"
                onClick={() => setCreateModal({ isOpen: true })}
              >
                <UserPlusIcon />
                <span>{intl.formatMessage(messages.createlocaluser)}</span>
              </Button>*/}
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
            <Table.TH>
              {(data.results ?? []).length > 1 && (
                <input
                  type="checkbox"
                  id="selectAll"
                  name="selectAll"
                  checked={isAllInstancesSelected()}
                  onChange={() => {
                    toggleAllInstances();
                  }}
                />
              )}
            </Table.TH>
            <Table.TH>{intl.formatMessage(messages.instanceName)}</Table.TH>
            <Table.TH>{intl.formatMessage(messages.instanceId)}</Table.TH>
            <Table.TH>
              {intl.formatMessage(messages.notificationAgent)}
            </Table.TH>
            <Table.TH></Table.TH>
          </tr>
        </thead>

        <Table.TBody>
          {data.results.map((instance) => (
            <tr
              key={`notification-instance-list-${instance.id}`}
              data-testid="notification-instance-list-row"
            >
              <Table.TD>
                <input
                  type="checkbox"
                  id={`notification-instance-list-select-${instance.id}`}
                  name={`notification-instance-list-select-${instance.id}`}
                  checked={isInstanceSelected(instance.id)}
                  onChange={() => {
                    toggleInstance(instance.id);
                  }}
                />
              </Table.TD>
              <Table.TD>{instance.name}</Table.TD>
              <Table.TD>{instance.id}</Table.TD>
              <Table.TD>{instance.agent}</Table.TD>
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
                    router.push(
                      '/users/[userId]/settings',
                      `/users/${instance.id}/settings`
                    )
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
                    testInstance(instance.id);
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
