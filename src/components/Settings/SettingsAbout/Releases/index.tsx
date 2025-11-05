import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import dynamic from 'next/dynamic';
import { Fragment, useState } from 'react';
import { FormattedRelativeTime, useIntl } from 'react-intl';
import useSWR from 'swr';

// dyanmic is having trouble extracting the props for react-markdown here so we are just ignoring it since its really
// only children we are using
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactMarkdown = dynamic<any>(() => import('react-markdown'), {
  ssr: false,
});

const messages = defineMessages('components.Settings.SettingsAbout.Releases', {
  releases: 'Releases',
  releasedataMissing: 'Release data is currently unavailable.',
  versionChangelog: '{version} Changelog',
  viewongithub: 'View on GitHub',
  latestversion: 'Latest',
  currentversion: 'Current',
  viewchangelog: 'View Changelog',
});

const REPO_RELEASE_API =
  'https://api.github.com/repos/seerr-team/seerr/releases?per_page=20';

interface GitHubRelease {
  url: string;
  assets_url: string;
  upload_url: string;
  html_url: string;
  id: number;
  node_id: string;
  tag_name: string;
  target_commitish: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  tarball_url: string;
  zipball_url: string;
  body: string;
}

interface ReleaseProps {
  release: GitHubRelease;
  isLatest: boolean;
  currentVersion: string;
}

const Release = ({ currentVersion, release, isLatest }: ReleaseProps) => {
  const intl = useIntl();
  const [isModalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex w-full flex-col space-y-3 rounded-md bg-gray-800 px-4 py-2 shadow-md ring-1 ring-gray-700 sm:flex-row sm:space-y-0 sm:space-x-3">
      <Transition
        as={Fragment}
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        show={isModalOpen}
      >
        <Modal
          onCancel={() => setModalOpen(false)}
          title={intl.formatMessage(messages.versionChangelog, {
            version: release.name,
          })}
          cancelText={intl.formatMessage(globalMessages.close)}
          okText={intl.formatMessage(messages.viewongithub)}
          onOk={() => {
            window.open(release.html_url, '_blank');
          }}
        >
          <div className="prose">
            <ReactMarkdown>{release.body}</ReactMarkdown>
          </div>
        </Modal>
      </Transition>
      <div className="flex w-full flex-grow items-center justify-center space-x-2 truncate sm:justify-start">
        <span className="truncate text-lg font-bold">
          <span className="mr-2 whitespace-nowrap text-xs font-normal">
            <FormattedRelativeTime
              value={Math.floor(
                (new Date(release.created_at).getTime() - Date.now()) / 1000
              )}
              updateIntervalInSeconds={1}
              numeric="auto"
            />
          </span>
          {release.name}
        </span>
        {isLatest && (
          <Badge badgeType="success">
            {intl.formatMessage(messages.latestversion)}
          </Badge>
        )}
        {release.name.includes(currentVersion) && (
          <Badge badgeType="primary">
            {intl.formatMessage(messages.currentversion)}
          </Badge>
        )}
      </div>
      <Button buttonType="primary" onClick={() => setModalOpen(true)}>
        <DocumentTextIcon />
        <span>{intl.formatMessage(messages.viewchangelog)}</span>
      </Button>
    </div>
  );
};

interface ReleasesProps {
  currentVersion: string;
}

const Releases = ({ currentVersion }: ReleasesProps) => {
  const intl = useIntl();
  const { data, error } = useSWR<GitHubRelease[]>(REPO_RELEASE_API);

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return (
      <div className="text-gray-300">
        {intl.formatMessage(messages.releasedataMissing)}
      </div>
    );
  }

  return (
    <div>
      <h3 className="heading">{intl.formatMessage(messages.releases)}</h3>
      <div className="section space-y-3">
        {data.map((release, index) => {
          return (
            <div key={`release-${release.id}`}>
              <Release
                release={release}
                currentVersion={currentVersion}
                isLatest={index === 0}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Releases;
