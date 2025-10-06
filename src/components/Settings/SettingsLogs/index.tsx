import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import PageTitle from '@app/components/Common/PageTitle';
import Table from '@app/components/Common/Table';
import Tooltip from '@app/components/Common/Tooltip';
import useDebouncedState from '@app/hooks/useDebouncedState';
import { useUpdateQueryParams } from '@app/hooks/useUpdateQueryParams';
import globalMessages from '@app/i18n/globalMessages';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { getBasedPath } from '@app/utils/navigationUtil';
import { Transition } from '@headlessui/react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentIcon,
  DocumentMagnifyingGlassIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PauseIcon,
  PlayIcon,
} from '@heroicons/react/24/solid';
import type {
  LogMessage,
  LogsResultsResponse,
} from '@server/interfaces/api/settingsInterfaces';
import copy from 'copy-to-clipboard';
import { useRouter } from 'next/router';
import { Fragment, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

const messages = defineMessages('components.Settings.SettingsLogs', {
  logs: 'Logs',
  logsDescription:
    'You can also view these logs directly via <code>stdout</code>, or in <code>{appDataPath}/logs/jellyseerr.log</code>.',
  time: 'Timestamp',
  level: 'Severity',
  label: 'Label',
  message: 'Message',
  filterDebug: 'Debug',
  filterInfo: 'Info',
  filterWarn: 'Warning',
  filterError: 'Error',
  showall: 'Show All Logs',
  pauseLogs: 'Pause',
  resumeLogs: 'Resume',
  copyToClipboard: 'Copy to Clipboard',
  logDetails: 'Log Details',
  extraData: 'Additional Data',
  copiedLogMessage: 'Copied log message to clipboard.',
  viewdetails: 'View Details',
});

type Filter = 'debug' | 'info' | 'warn' | 'error';

const SettingsLogs = () => {
  const router = useRouter();
  const intl = useIntl();
  const { addToast } = useToasts();
  const [currentFilter, setCurrentFilter] = useState<Filter>('debug');
  const [currentPageSize, setCurrentPageSize] = useState(25);
  const [searchFilter, debouncedSearchFilter, setSearchFilter] =
    useDebouncedState('');
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [activeLog, setActiveLog] = useState<{
    isOpen: boolean;
    log?: LogMessage;
  }>({ isOpen: false });

  const page = router.query.page ? Number(router.query.page) : 1;
  const pageIndex = page - 1;
  const updateQueryParams = useUpdateQueryParams({ page: page.toString() });

  const toggleLogs = () => {
    setRefreshInterval(refreshInterval === 5000 ? 0 : 5000);
  };

  const { data, error } = useSWR<LogsResultsResponse>(
    `/api/v1/settings/logs?take=${currentPageSize}&skip=${
      pageIndex * currentPageSize
    }&filter=${currentFilter}${
      debouncedSearchFilter ? `&search=${debouncedSearchFilter}` : ''
    }`,
    {
      refreshInterval: refreshInterval,
      revalidateOnFocus: false,
    }
  );

  const { data: appData } = useSWR('/api/v1/status/appdata');

  useEffect(() => {
    const filterString = window.localStorage.getItem('logs-display-settings');

    if (filterString) {
      const filterSettings = JSON.parse(filterString);

      setCurrentFilter(filterSettings.currentFilter);
      setCurrentPageSize(filterSettings.currentPageSize);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      'logs-display-settings',
      JSON.stringify({
        currentFilter,
        currentPageSize,
      })
    );
  }, [currentFilter, currentPageSize]);

  const copyLogString = (log: LogMessage): void => {
    copy(
      `${log.timestamp} [${log.level}]${log.label ? `[${log.label}]` : ''}: ${
        log.message
      }${log.data ? `${JSON.stringify(log.data)}` : ''}`
    );
    addToast(intl.formatMessage(messages.copiedLogMessage), {
      appearance: 'success',
      autoDismiss: true,
    });
  };

  // check if there's no data and no errors in the table
  // so as to show a spinner inside the table and not refresh the whole component
  if (!data && error) {
    return <Error statusCode={500} />;
  }

  const hasNextPage = data?.pageInfo.pages ?? 0 > pageIndex + 1;
  const hasPrevPage = pageIndex > 0;

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.logs),
          intl.formatMessage(globalMessages.settings),
        ]}
      />
      <Transition
        as={Fragment}
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        appear
        show={activeLog.isOpen}
      >
        <Modal
          title={intl.formatMessage(messages.logDetails)}
          onCancel={() => setActiveLog({ log: activeLog.log, isOpen: false })}
          cancelText={intl.formatMessage(globalMessages.close)}
          onOk={() =>
            activeLog.log ? copyLogString(activeLog.log) : undefined
          }
          okText={intl.formatMessage(messages.copyToClipboard)}
          okButtonType="primary"
        >
          {activeLog && (
            <>
              <div className="form-row">
                <div className="text-label">
                  {intl.formatMessage(messages.time)}
                </div>
                <div className="mb-1 text-sm font-medium leading-5 text-gray-400 sm:mt-2">
                  <div className="flex max-w-lg items-center">
                    {intl.formatDate(activeLog.log?.timestamp, {
                      year: 'numeric',
                      month: 'short',
                      day: '2-digit',
                      hour: 'numeric',
                      minute: 'numeric',
                      second: 'numeric',
                    })}
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="text-label">
                  {intl.formatMessage(messages.level)}
                </div>
                <div className="mb-1 text-sm font-medium leading-5 text-gray-400 sm:mt-2">
                  <div className="flex max-w-lg items-center">
                    <Badge
                      badgeType={
                        activeLog.log?.level === 'error'
                          ? 'danger'
                          : activeLog.log?.level === 'warn'
                          ? 'warning'
                          : activeLog.log?.level === 'info'
                          ? 'success'
                          : 'default'
                      }
                    >
                      {activeLog.log?.level.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="text-label">
                  {intl.formatMessage(messages.label)}
                </div>
                <div className="mb-1 text-sm font-medium leading-5 text-gray-400 sm:mt-2">
                  <div className="flex max-w-lg items-center">
                    {activeLog.log?.label}
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="text-label">
                  {intl.formatMessage(messages.message)}
                </div>
                <div className="col-span-2 mb-1 text-sm font-medium leading-5 text-gray-400 sm:mt-2">
                  <div className="flex max-w-lg items-center">
                    {activeLog.log?.message}
                  </div>
                </div>
              </div>
              {activeLog.log?.data && (
                <div className="form-row">
                  <div className="text-label">
                    {intl.formatMessage(messages.extraData)}
                  </div>
                  <div className="col-span-2 mb-1 text-sm font-medium leading-5 text-gray-400 sm:mt-2">
                    <code className="block max-h-64 w-full overflow-auto whitespace-pre bg-gray-800 px-6 py-4 ring-1 ring-gray-700">
                      {JSON.stringify(activeLog.log?.data, null, ' ')}
                    </code>
                  </div>
                </div>
              )}
            </>
          )}
        </Modal>
      </Transition>
      <div className="mb-2">
        <h3 className="heading">{intl.formatMessage(messages.logs)}</h3>
        <p className="description">
          {intl.formatMessage(messages.logsDescription, {
            code: (msg: React.ReactNode) => (
              <code className="whitespace-normal break-words bg-opacity-50">
                {msg}
              </code>
            ),
            appDataPath: appData ? appData.appDataPath : '/app/config',
          })}
        </p>
        <div className="mt-2 flex flex-grow flex-col sm:flex-grow-0 sm:flex-row sm:justify-end">
          <div className="mb-2 flex flex-grow sm:mb-0 sm:mr-2 md:flex-grow-0">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
              <MagnifyingGlassIcon className="h-6 w-6" />
            </span>
            <input
              type="text"
              className="rounded-r-only"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value as string)}
            />
          </div>
          <div className="mb-2 flex flex-1 flex-row justify-between sm:mb-0 sm:flex-none">
            <Button
              className="mr-2 flex flex-grow"
              buttonType={refreshInterval ? 'default' : 'primary'}
              onClick={() => toggleLogs()}
            >
              {refreshInterval ? <PauseIcon /> : <PlayIcon />}
              <span>
                {intl.formatMessage(
                  refreshInterval ? messages.pauseLogs : messages.resumeLogs
                )}
              </span>
            </Button>
            <div className="flex flex-grow">
              <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
                <FunnelIcon className="h-6 w-6" />
              </span>
              <select
                id="filter"
                name="filter"
                onChange={(e) => {
                  setCurrentFilter(e.target.value as Filter);
                  router.push(getBasedPath(router.pathname));
                }}
                value={currentFilter}
                className="rounded-r-only"
              >
                <option value="debug">
                  {intl.formatMessage(messages.filterDebug)}
                </option>
                <option value="info">
                  {intl.formatMessage(messages.filterInfo)}
                </option>
                <option value="warn">
                  {intl.formatMessage(messages.filterWarn)}
                </option>
                <option value="error">
                  {intl.formatMessage(messages.filterError)}
                </option>
              </select>
            </div>
          </div>
        </div>
        <Table>
          <thead>
            <tr>
              <Table.TH>{intl.formatMessage(messages.time)}</Table.TH>
              <Table.TH>{intl.formatMessage(messages.level)}</Table.TH>
              <Table.TH>{intl.formatMessage(messages.label)}</Table.TH>
              <Table.TH>{intl.formatMessage(messages.message)}</Table.TH>
              <Table.TH></Table.TH>
            </tr>
          </thead>
          <Table.TBody>
            {!data ? (
              <tr>
                <Table.TD colSpan={5} noPadding>
                  <LoadingSpinner />
                </Table.TD>
              </tr>
            ) : (
              data.results.map((row: LogMessage, index: number) => {
                return (
                  <tr key={`log-list-${index}`}>
                    <Table.TD className="text-gray-300">
                      {intl.formatDate(row.timestamp, {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                        hour: 'numeric',
                        minute: 'numeric',
                        second: 'numeric',
                      })}
                    </Table.TD>
                    <Table.TD className="text-gray-300">
                      <Badge
                        badgeType={
                          row.level === 'error'
                            ? 'danger'
                            : row.level === 'warn'
                            ? 'warning'
                            : row.level === 'info'
                            ? 'success'
                            : 'default'
                        }
                      >
                        {row.level.toUpperCase()}
                      </Badge>
                    </Table.TD>
                    <Table.TD className="text-gray-300">
                      {row.label ?? ''}
                    </Table.TD>
                    <Table.TD className="text-gray-300">{row.message}</Table.TD>
                    <Table.TD className="-m-1 flex flex-wrap items-center justify-end">
                      {row.data && (
                        <Tooltip
                          content={intl.formatMessage(messages.viewdetails)}
                        >
                          <Button
                            buttonSize="sm"
                            buttonType="primary"
                            onClick={() =>
                              setActiveLog({ log: row, isOpen: true })
                            }
                            className="m-1"
                          >
                            <DocumentMagnifyingGlassIcon className="icon-md" />
                          </Button>
                        </Tooltip>
                      )}
                      <Tooltip
                        content={intl.formatMessage(messages.copyToClipboard)}
                      >
                        <Button
                          buttonType="primary"
                          buttonSize="sm"
                          onClick={() => copyLogString(row)}
                          className="m-1"
                        >
                          <ClipboardDocumentIcon className="icon-md" />
                        </Button>
                      </Tooltip>
                    </Table.TD>
                  </tr>
                );
              })
            )}

            {data?.results.length === 0 && (
              <tr className="relative h-24 p-2 text-white">
                <Table.TD colSpan={5} noPadding>
                  <div className="flex w-screen flex-col items-center justify-center p-6 md:w-full">
                    <span className="text-base">
                      {intl.formatMessage(globalMessages.noresults)}
                    </span>
                    {currentFilter !== 'debug' && (
                      <div className="mt-4">
                        <Button
                          buttonSize="sm"
                          buttonType="primary"
                          onClick={() => setCurrentFilter('debug')}
                        >
                          {intl.formatMessage(messages.showall)}
                        </Button>
                      </div>
                    )}
                  </div>
                </Table.TD>
              </tr>
            )}
            <tr className="bg-gray-700">
              <Table.TD colSpan={5} noPadding>
                <nav
                  className="flex w-screen flex-col items-center space-x-4 space-y-3 px-6 py-3 sm:flex-row sm:space-y-0 md:w-full"
                  aria-label="Pagination"
                >
                  <div className="hidden lg:flex lg:flex-1">
                    <p className="text-sm">
                      {(data?.results.length ?? 0) > 0 &&
                        intl.formatMessage(globalMessages.showingresults, {
                          from: pageIndex * currentPageSize + 1,
                          to:
                            data?.results.length ?? 0 < currentPageSize
                              ? pageIndex * currentPageSize +
                                (data?.results.length ?? 0)
                              : (pageIndex + 1) * currentPageSize,
                          total: data?.pageInfo.results ?? 0,
                          strong: (msg: React.ReactNode) => (
                            <span className="font-medium">{msg}</span>
                          ),
                        })}
                    </p>
                  </div>
                  <div className="flex justify-center sm:flex-1 sm:justify-start md:justify-center">
                    <span className="-mt-3 items-center text-sm sm:-ml-4 sm:mt-0 md:ml-0">
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
      </div>
    </>
  );
};

export default SettingsLogs;
