import DiscordLogo from '@app/assets/extlogos/discord.svg';
import GotifyLogo from '@app/assets/extlogos/gotify.svg';
import NtfyLogo from '@app/assets/extlogos/ntfy.svg';
import PushbulletLogo from '@app/assets/extlogos/pushbullet.svg';
import PushoverLogo from '@app/assets/extlogos/pushover.svg';
import SlackLogo from '@app/assets/extlogos/slack.svg';
import TelegramLogo from '@app/assets/extlogos/telegram.svg';
import Dropdown from '@app/components/Common/Dropdown';
import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import NotificationInstanceList from '@app/components/Settings/SettingsNotifications/NotificationInstanceList';
import NotificationModal, {
  NotificationModalType,
} from '@app/components/Settings/SettingsNotifications/NotificationModal';
import { useUpdateQueryParams } from '@app/hooks/useUpdateQueryParams';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import {
  BarsArrowDownIcon,
  BoltIcon,
  CloudIcon,
  EnvelopeIcon,
  PlusIcon,
} from '@heroicons/react/24/solid';
import type { NotificationSettingsResultResponse } from '@server/interfaces/api/settingsInterfaces';
import type { NotificationAgentConfig } from '@server/interfaces/settings';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Settings.SettingsNotifications', {
  notifications: 'Notifications',
  notificationInstanceList: 'Notification Instance List',
  createNotificationInstance: 'Create Notification Instance',
  instanceName: 'Name',
  instanceId: 'ID',
  notificationAgent: 'Agent',
});

enum Sort {
  ID = 'id',
  NAME = 'name',
  AGENT = 'agent',
}

const SettingsNotifications = () => {
  const intl = useIntl();
  const router = useRouter();
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

  const onNotificationInstanceEdit = (instance: NotificationAgentConfig) => {
    setNotificationModal({
      open: true,
      instance: instance,
      type: NotificationModalType.EDIT,
    });
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

      <NotificationInstanceList
        instances={data.results}
        revalidateInstances={revalidate}
        onEdit={onNotificationInstanceEdit}
        currentPageIndex={pageIndex}
        currentPageSize={currentPageSize}
        setCurrentPageSize={setCurrentPageSize}
        hasPrevPage={hasPrevPage}
        hasNextPage={hasNextPage}
        updateQueryParams={updateQueryParams}
        totalItemsSize={data.pageInfo.results}
      />
    </>
  );
};

export default SettingsNotifications;
