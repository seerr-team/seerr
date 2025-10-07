import Alert from '@app/components/Common/Alert';
import Badge from '@app/components/Common/Badge';
import List from '@app/components/Common/List';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import Releases from '@app/components/Settings/SettingsAbout/Releases';
import globalMessages from '@app/i18n/globalMessages';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { InformationCircleIcon } from '@heroicons/react/24/solid';
import type {
  SettingsAboutResponse,
  StatusResponse,
} from '@server/interfaces/api/settingsInterfaces';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Settings.SettingsAbout', {
  about: 'About',
  aboutseerr: 'About Seerr',
  version: 'Version',
  totalmedia: 'Total Media',
  totalrequests: 'Total Requests',
  gettingsupport: 'Getting Support',
  githubdiscussions: 'GitHub Discussions',
  timezone: 'Time Zone',
  appDataPath: 'Data Directory',
  supportseerr: 'Support Seerr',
  contribute: 'Make a Contribution',
  documentation: 'Documentation',
  outofdate: 'Out of Date',
  uptodate: 'Up to Date',
  betawarning:
    'This is BETA software. Features may be broken and/or unstable. Please report any issues on GitHub!',
  runningDevelop:
    'You are running the <code>develop</code> branch of Seerr, which is only recommended for those contributing to development or assisting with bleeding-edge testing.',
});

const SettingsAbout = () => {
  const intl = useIntl();
  const { data, error } = useSWR<SettingsAboutResponse>(
    '/api/v1/settings/about'
  );

  const { data: status } = useSWR<StatusResponse>('/api/v1/status');

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <Error statusCode={500} />;
  }

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.about),
          intl.formatMessage(globalMessages.settings),
        ]}
      />
      <div className="mt-6 rounded-md border border-indigo-500 bg-indigo-400 bg-opacity-20 p-4 backdrop-blur">
        <div className="flex">
          <div className="flex-shrink-0">
            <InformationCircleIcon className="h-5 w-5 text-gray-100" />
          </div>
          <div className="ml-3 flex-1 md:flex md:justify-between">
            <p className="text-sm leading-5 text-gray-100">
              {intl.formatMessage(messages.betawarning)}
            </p>
            <p className="mt-3 text-sm leading-5 md:mt-0 md:ml-6">
              <a
                href="http://github.com/seerr-team/seerr"
                className="whitespace-nowrap font-medium text-gray-100 transition duration-150 ease-in-out hover:text-white"
                target="_blank"
                rel="noreferrer"
              >
                GitHub &rarr;
              </a>
            </p>
          </div>
        </div>
      </div>
      <div className="section">
        <List title={intl.formatMessage(messages.aboutseerr)}>
          {data.version.startsWith('develop-') && (
            <Alert
              title={intl.formatMessage(messages.runningDevelop, {
                code: (msg: React.ReactNode) => (
                  <code className="bg-opacity-50">{msg}</code>
                ),
              })}
            />
          )}
          <List.Item
            title={intl.formatMessage(messages.version)}
            className="flex flex-row items-center truncate"
          >
            <code className="truncate">
              {data.version.replace('develop-', '')}
            </code>
            {status?.commitTag !== 'local' &&
              (status?.updateAvailable ? (
                <a
                  href={
                    data.version.startsWith('develop-')
                      ? `https://github.com/seerr-team/seerr/compare/${status.commitTag}...develop`
                      : 'https://github.com/seerr-team/seerr/releases'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Badge
                    badgeType="warning"
                    className="ml-2 !cursor-pointer transition hover:bg-yellow-400"
                  >
                    {intl.formatMessage(messages.outofdate)}
                  </Badge>
                </a>
              ) : (
                <a
                  href={
                    data.version.startsWith('develop-')
                      ? 'https://github.com/seerr-team/seerr/commits/develop'
                      : 'https://github.com/seerr-team/seerr/releases'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Badge
                    badgeType="success"
                    className="ml-2 !cursor-pointer transition hover:bg-green-400"
                  >
                    {intl.formatMessage(messages.uptodate)}
                  </Badge>
                </a>
              ))}
          </List.Item>
          <List.Item title={intl.formatMessage(messages.totalmedia)}>
            {intl.formatNumber(data.totalMediaItems)}
          </List.Item>
          <List.Item title={intl.formatMessage(messages.totalrequests)}>
            {intl.formatNumber(data.totalRequests)}
          </List.Item>
          <List.Item title={intl.formatMessage(messages.appDataPath)}>
            <code>{data.appDataPath}</code>
          </List.Item>
          {data.tz && (
            <List.Item title={intl.formatMessage(messages.timezone)}>
              <code>{data.tz}</code>
            </List.Item>
          )}
        </List>
      </div>
      <div className="section">
        <List title={intl.formatMessage(messages.gettingsupport)}>
          <List.Item title={intl.formatMessage(messages.documentation)}>
            <a
              href="https://docs.seerr.dev"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-500 transition duration-300 hover:underline"
            >
              https://docs.seerr.dev
            </a>
          </List.Item>
          <List.Item title={intl.formatMessage(messages.githubdiscussions)}>
            <a
              href="https://github.com/seerr-team/seerr/discussions"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-500 transition duration-300 hover:underline"
            >
              https://github.com/seerr-team/seerr/discussions
            </a>
          </List.Item>
          <List.Item title="Discord">
            <a
              href="https://discord.gg/seerr"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-500 transition duration-300 hover:underline"
            >
              https://discord.gg/seerr
            </a>
          </List.Item>
        </List>
      </div>
      <div className="section">
        <List title={intl.formatMessage(messages.supportseerr)}>
          <List.Item title={intl.formatMessage(messages.contribute)}>
            <a
              href="https://opencollective.com/seerr"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-500 transition duration-300 hover:underline"
            >
              https://opencollective.com/seerr
            </a>
          </List.Item>
        </List>
      </div>
      <div className="section">
        <Releases currentVersion={data.version} />
      </div>
    </>
  );
};

export default SettingsAbout;
