/* eslint-disable react-hooks/exhaustive-deps */
import CachedImage from '@app/components/Common/CachedImage';
import { SmallLoadingSpinner } from '@app/components/Common/LoadingSpinner';
import type { User } from '@app/hooks/useUser';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { formatBytes } from '@app/utils/numberHelpers';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import type {
  ServiceCommonServer,
  ServiceCommonServerWithDetails,
} from '@server/interfaces/api/serviceInterfaces';
import type { UserResultsResponse } from '@server/interfaces/api/userInterfaces';
import { hasPermission } from '@server/lib/permissions';
import { isEqual } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import Select from 'react-select';
import useSWR from 'swr';

type OptionType = {
  value: number;
  label: string;
};

const messages = defineMessages('components.RequestModal.AdvancedRequester', {
  advancedoptions: 'Advanced',
  destinationserver: 'Destination Server',
  qualityprofile: 'Quality Profile',
  rootfolder: 'Root Folder',
  animenote: '* This series is an anime.',
  default: '{name} (Default)',
  folder: '{path} ({space})',
  requestas: 'Request As',
  languageprofile: 'Language Profile',
  tags: 'Tags',
  selecttags: 'Select tags',
  notagoptions: 'No tags.',
});

export type RequestOverrides = {
  server?: number;
  profile?: number;
  folder?: string;
  tags?: number[];
  language?: number;
  user?: User;
};

interface AdvancedRequesterProps {
  type: 'movie' | 'tv' | 'music';
  is4k: boolean;
  isAnime?: boolean;
  defaultOverrides?: RequestOverrides;
  requestUser?: User;
  onChange: (overrides: RequestOverrides) => void;
}

const AdvancedRequester = ({
  type,
  is4k = false,
  isAnime = false,
  defaultOverrides,
  requestUser,
  onChange,
}: AdvancedRequesterProps) => {
  const intl = useIntl();
  const { user: currentUser, hasPermission: currentHasPermission } = useUser();
  const { data, error } = useSWR<ServiceCommonServer[]>(
    `/api/v1/service/${
      type === 'movie' ? 'radarr' : type === 'tv' ? 'sonarr' : 'lidarr'
    }`,
    {
      refreshInterval: 0,
      refreshWhenHidden: false,
      revalidateOnFocus: false,
      revalidateOnMount: true,
    }
  );
  const [selectedServer, setSelectedServer] = useState<number | null>(
    defaultOverrides?.server !== undefined && defaultOverrides?.server >= 0
      ? defaultOverrides?.server
      : null
  );
  const [selectedProfile, setSelectedProfile] = useState<number>(
    defaultOverrides?.profile ?? -1
  );
  const [selectedFolder, setSelectedFolder] = useState<string>(
    defaultOverrides?.folder ?? ''
  );

  const [selectedLanguage, setSelectedLanguage] = useState<number>(
    defaultOverrides?.language ?? -1
  );

  const [selectedTags, setSelectedTags] = useState<number[]>(
    defaultOverrides?.tags ?? []
  );

  const { data: serverData, isValidating } =
    useSWR<ServiceCommonServerWithDetails>(
      selectedServer !== null
        ? `/api/v1/service/${
            type === 'movie' ? 'radarr' : type === 'tv' ? 'sonarr' : 'lidarr'
          }/${selectedServer}`
        : null,
      {
        refreshInterval: 0,
        refreshWhenHidden: false,
        revalidateOnFocus: false,
      }
    );

  const [selectedUser, setSelectedUser] = useState<User | null>(
    requestUser ?? null
  );

  const { data: userData } = useSWR<UserResultsResponse>(
    currentHasPermission([Permission.MANAGE_REQUESTS, Permission.MANAGE_USERS])
      ? '/api/v1/user?take=1000&sort=displayname'
      : null
  );
  const filteredUserData = useMemo(
    () =>
      userData?.results.filter((user) =>
        hasPermission(
          is4k
            ? [
                Permission.REQUEST_4K,
                type === 'movie'
                  ? Permission.REQUEST_4K_MOVIE
                  : Permission.REQUEST_4K_TV,
              ]
            : [
                Permission.REQUEST,
                type === 'movie'
                  ? Permission.REQUEST_MOVIE
                  : type === 'tv'
                  ? Permission.REQUEST_TV
                  : Permission.REQUEST_MUSIC,
              ],
          user.permissions,
          { type: 'or' }
        )
      ),
    [userData?.results]
  );

  useEffect(() => {
    if (filteredUserData && !requestUser) {
      setSelectedUser(
        filteredUserData.find((u) => u.id === currentUser?.id) ?? null
      );
    }
  }, [filteredUserData]);

  useEffect(() => {
    let defaultServer = data?.find(
      (server) => server.isDefault && is4k === server.is4k
    );

    if (!defaultServer && (data ?? []).length > 0) {
      defaultServer = data?.[0];
    }

    if (
      defaultServer &&
      defaultServer.id !== selectedServer &&
      (!defaultOverrides || defaultOverrides.server === null)
    ) {
      setSelectedServer(defaultServer.id);
    }
  }, [data]);

  useEffect(() => {
    if (serverData) {
      const defaultProfile = serverData.profiles.find(
        (profile) =>
          profile.id ===
          (isAnime && serverData.server.activeAnimeProfileId
            ? serverData.server.activeAnimeProfileId
            : serverData.server.activeProfileId)
      );
      const defaultFolder = serverData.rootFolders.find(
        (folder) =>
          folder.path ===
          (isAnime && serverData.server.activeAnimeDirectory
            ? serverData.server.activeAnimeDirectory
            : serverData.server.activeDirectory)
      );
      const defaultLanguage = serverData.languageProfiles?.find(
        (language) =>
          language.id ===
          (isAnime && serverData.server.activeAnimeLanguageProfileId
            ? serverData.server.activeAnimeLanguageProfileId
            : serverData.server.activeLanguageProfileId)
      );
      const defaultTags = isAnime
        ? serverData.server.activeAnimeTags
        : serverData.server.activeTags;

      const applyOverrides =
        defaultOverrides &&
        ((defaultOverrides.server === null && serverData.server.isDefault) ||
          defaultOverrides.server === serverData.server.id);

      if (
        defaultProfile &&
        defaultProfile.id !== selectedProfile &&
        (!applyOverrides || defaultOverrides.profile === null)
      ) {
        setSelectedProfile(defaultProfile.id);
      }

      if (
        defaultFolder &&
        defaultFolder.path !== selectedFolder &&
        (!applyOverrides || !defaultOverrides.folder)
      ) {
        setSelectedFolder(defaultFolder.path ?? '');
      }

      if (
        defaultLanguage &&
        defaultLanguage.id !== selectedLanguage &&
        (!applyOverrides || defaultOverrides.language === null)
      ) {
        setSelectedLanguage(defaultLanguage.id);
      }

      if (
        defaultTags &&
        !isEqual(defaultTags, selectedTags) &&
        (!applyOverrides || defaultOverrides.tags === null)
      ) {
        setSelectedTags(defaultTags);
      }
    }
  }, [serverData]);

  useEffect(() => {
    if (defaultOverrides && defaultOverrides.server != null) {
      setSelectedServer(defaultOverrides.server);
    }

    if (defaultOverrides && defaultOverrides.profile != null) {
      setSelectedProfile(defaultOverrides.profile);
    }

    if (defaultOverrides && defaultOverrides.folder) {
      setSelectedFolder(defaultOverrides.folder);
    }

    if (defaultOverrides && defaultOverrides.language != null) {
      setSelectedLanguage(defaultOverrides.language);
    }

    if (defaultOverrides && defaultOverrides.tags != null) {
      setSelectedTags(defaultOverrides.tags);
    }
  }, [
    defaultOverrides?.server,
    defaultOverrides?.folder,
    defaultOverrides?.profile,
    defaultOverrides?.language,
    defaultOverrides?.tags,
  ]);

  useEffect(() => {
    if (selectedServer !== null || selectedUser) {
      onChange({
        folder: selectedFolder !== '' ? selectedFolder : undefined,
        profile: selectedProfile !== -1 ? selectedProfile : undefined,
        server: selectedServer ?? undefined,
        user: selectedUser ?? undefined,
        language: selectedLanguage !== -1 ? selectedLanguage : undefined,
        tags: selectedTags,
      });
    }
  }, [
    selectedFolder,
    selectedServer,
    selectedProfile,
    selectedUser,
    selectedLanguage,
    selectedTags,
  ]);

  if (!data && !error) {
    return (
      <div className="mb-2 w-full">
        <SmallLoadingSpinner />
      </div>
    );
  }

  if (
    (!data ||
      selectedServer === null ||
      (data.filter((server) => server.is4k === is4k).length < 2 &&
        (!serverData ||
          (serverData.profiles.length < 2 &&
            serverData.rootFolders.length < 2 &&
            (serverData.languageProfiles ?? []).length < 2 &&
            !serverData.tags?.length)))) &&
    (!selectedUser || (filteredUserData ?? []).length < 2)
  ) {
    return null;
  }

  return (
    <>
      <div className="mt-4 mb-2 flex items-center text-lg font-semibold">
        {intl.formatMessage(messages.advancedoptions)}
      </div>
      <div className="rounded-md">
        {!!data && selectedServer !== null && (
          <div className="flex flex-col md:flex-row">
            {data.filter((server) => server.is4k === is4k).length > 1 && (
              <div className="mb-3 w-full flex-shrink-0 flex-grow last:pr-0 md:w-1/4 md:pr-4">
                <label htmlFor="server">
                  {intl.formatMessage(messages.destinationserver)}
                </label>
                <select
                  id="server"
                  name="server"
                  value={selectedServer}
                  onChange={(e) => setSelectedServer(Number(e.target.value))}
                  onBlur={(e) => setSelectedServer(Number(e.target.value))}
                  className="border-gray-700 bg-gray-800"
                >
                  {data
                    .filter((server) => server.is4k === is4k)
                    .map((server) => (
                      <option
                        key={`server-list-${server.id}`}
                        value={server.id}
                      >
                        {server.isDefault
                          ? intl.formatMessage(messages.default, {
                              name: server.name,
                            })
                          : server.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            {(isValidating ||
              !serverData ||
              serverData.profiles.length > 1) && (
              <div className="mb-3 w-full flex-shrink-0 flex-grow last:pr-0 md:w-1/4 md:pr-4">
                <label htmlFor="profile">
                  {intl.formatMessage(messages.qualityprofile)}
                </label>
                <select
                  id="profile"
                  name="profile"
                  value={selectedProfile}
                  onChange={(e) => setSelectedProfile(Number(e.target.value))}
                  onBlur={(e) => setSelectedProfile(Number(e.target.value))}
                  className="border-gray-700 bg-gray-800"
                  disabled={isValidating || !serverData}
                >
                  {(isValidating || !serverData) && (
                    <option value="">
                      {intl.formatMessage(globalMessages.loading)}
                    </option>
                  )}
                  {!isValidating &&
                    serverData &&
                    serverData.profiles.map((profile) => (
                      <option
                        key={`profile-list${profile.id}`}
                        value={profile.id}
                      >
                        {isAnime &&
                        serverData.server.activeAnimeProfileId === profile.id
                          ? intl.formatMessage(messages.default, {
                              name: profile.name,
                            })
                          : !isAnime &&
                            serverData.server.activeProfileId === profile.id
                          ? intl.formatMessage(messages.default, {
                              name: profile.name,
                            })
                          : profile.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            {(isValidating ||
              !serverData ||
              serverData.rootFolders.length > 1) && (
              <div className="mb-3 w-full flex-shrink-0 flex-grow last:pr-0 md:w-1/4 md:pr-4">
                <label htmlFor="folder">
                  {intl.formatMessage(messages.rootfolder)}
                </label>
                <select
                  id="folder"
                  name="folder"
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  onBlur={(e) => setSelectedFolder(e.target.value)}
                  className="border-gray-700 bg-gray-800"
                  disabled={isValidating || !serverData}
                >
                  {(isValidating || !serverData) && (
                    <option value="">
                      {intl.formatMessage(globalMessages.loading)}
                    </option>
                  )}
                  {!isValidating &&
                    serverData &&
                    serverData.rootFolders.map((folder) => (
                      <option
                        key={`folder-list${folder.id}`}
                        value={folder.path}
                      >
                        {isAnime &&
                        serverData.server.activeAnimeDirectory === folder.path
                          ? intl.formatMessage(messages.default, {
                              name: intl.formatMessage(messages.folder, {
                                path: folder.path,
                                space: formatBytes(folder.freeSpace ?? 0),
                              }),
                            })
                          : !isAnime &&
                            serverData.server.activeDirectory === folder.path
                          ? intl.formatMessage(messages.default, {
                              name: intl.formatMessage(messages.folder, {
                                path: folder.path,
                                space: formatBytes(folder.freeSpace ?? 0),
                              }),
                            })
                          : intl.formatMessage(messages.folder, {
                              path: folder.path,
                              space: formatBytes(folder.freeSpace ?? 0),
                            })}
                      </option>
                    ))}
                </select>
              </div>
            )}
            {type === 'tv' &&
              (isValidating ||
                !serverData ||
                (serverData.languageProfiles ?? []).length > 1) && (
                <div className="mb-3 w-full flex-shrink-0 flex-grow last:pr-0 md:w-1/4 md:pr-4">
                  <label htmlFor="language">
                    {intl.formatMessage(messages.languageprofile)}
                  </label>
                  <select
                    id="language"
                    name="language"
                    value={selectedLanguage}
                    onChange={(e) =>
                      setSelectedLanguage(parseInt(e.target.value))
                    }
                    onBlur={(e) =>
                      setSelectedLanguage(parseInt(e.target.value))
                    }
                    className="border-gray-700 bg-gray-800"
                    disabled={isValidating || !serverData}
                  >
                    {(isValidating || !serverData) && (
                      <option value="">
                        {intl.formatMessage(globalMessages.loading)}
                      </option>
                    )}
                    {!isValidating &&
                      serverData &&
                      serverData.languageProfiles?.map((language) => (
                        <option
                          key={`folder-list${language.id}`}
                          value={language.id}
                        >
                          {isAnime &&
                          serverData.server.activeAnimeLanguageProfileId ===
                            language.id
                            ? intl.formatMessage(messages.default, {
                                name: language.name,
                              })
                            : !isAnime &&
                              serverData.server.activeLanguageProfileId ===
                                language.id
                            ? intl.formatMessage(messages.default, {
                                name: language.name,
                              })
                            : language.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
          </div>
        )}
        {selectedServer !== null &&
          (isValidating || !serverData || !!serverData?.tags?.length) && (
            <div className="mb-2">
              <label htmlFor="tags">{intl.formatMessage(messages.tags)}</label>
              <Select<OptionType, true>
                name="tags"
                options={(serverData?.tags ?? []).map((tag) => ({
                  label: tag.label,
                  value: tag.id,
                }))}
                isMulti
                isDisabled={isValidating || !serverData}
                placeholder={
                  isValidating || !serverData
                    ? intl.formatMessage(globalMessages.loading)
                    : intl.formatMessage(messages.selecttags)
                }
                className="react-select-container react-select-container-dark"
                classNamePrefix="react-select"
                value={
                  selectedTags
                    .map((tagId) => {
                      const foundTag = serverData?.tags.find(
                        (tag) => tag.id === tagId
                      );

                      if (!foundTag) {
                        return undefined;
                      }

                      return {
                        value: foundTag.id,
                        label: foundTag.label,
                      };
                    })
                    .filter((option) => option !== undefined) as OptionType[]
                }
                onChange={(value) => {
                  setSelectedTags(value.map((option) => option.value));
                }}
                noOptionsMessage={() =>
                  intl.formatMessage(messages.notagoptions)
                }
              />
            </div>
          )}
        {currentHasPermission([
          Permission.MANAGE_REQUESTS,
          Permission.MANAGE_USERS,
        ]) &&
          selectedUser &&
          (filteredUserData ?? []).length > 1 && (
            <Listbox
              as="div"
              value={selectedUser}
              onChange={(value) => setSelectedUser(value)}
              className="space-y-1"
            >
              {({ open }) => (
                <>
                  <Listbox.Label>
                    {intl.formatMessage(messages.requestas)}
                  </Listbox.Label>
                  <div className="relative">
                    <span className="inline-block w-full rounded-md shadow-sm">
                      <Listbox.Button className="focus:shadow-outline-blue relative w-full cursor-default rounded-md border border-gray-700 bg-gray-800 py-2 pl-3 pr-10 text-left text-white transition duration-150 ease-in-out focus:border-blue-300 focus:outline-none sm:text-sm sm:leading-5">
                        <span className="flex items-center">
                          <CachedImage
                            type="avatar"
                            src={selectedUser.avatar}
                            alt=""
                            className="h-6 w-6 flex-shrink-0 rounded-full object-cover"
                            width={24}
                            height={24}
                          />
                          <span className="ml-3 block">
                            {selectedUser.displayName}
                          </span>
                          {selectedUser.displayName.toLowerCase() !==
                            selectedUser.email && (
                            <span className="ml-1 truncate text-gray-400">
                              ({selectedUser.email})
                            </span>
                          )}
                        </span>
                        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500">
                          <ChevronDownIcon className="h-5 w-5" />
                        </span>
                      </Listbox.Button>
                    </span>

                    <Transition
                      show={open}
                      enter="transition-opacity ease-in duration-300"
                      enterFrom="opacity-0"
                      enterTo="opacity-100"
                      leave="transition-opacity ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                      className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 shadow-lg"
                    >
                      <Listbox.Options
                        static
                        className="shadow-xs max-h-60 overflow-auto rounded-md py-1 text-base leading-6 focus:outline-none sm:text-sm sm:leading-5"
                      >
                        {filteredUserData?.map((user) => (
                          <Listbox.Option key={user.id} value={user}>
                            {({ selected, active }) => (
                              <div
                                className={`${
                                  active
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-gray-300'
                                } relative cursor-default select-none py-2 pl-8 pr-4`}
                              >
                                <span
                                  className={`${
                                    selected ? 'font-semibold' : 'font-normal'
                                  } flex items-center`}
                                >
                                  <CachedImage
                                    type="avatar"
                                    src={user.avatar}
                                    alt=""
                                    className="h-6 w-6 flex-shrink-0 rounded-full object-cover"
                                    width={24}
                                    height={24}
                                  />
                                  <span className="ml-3 block flex-shrink-0">
                                    {user.displayName}
                                  </span>
                                  {user.displayName.toLowerCase() !==
                                    user.email && (
                                    <span className="ml-1 truncate text-gray-400">
                                      ({user.email})
                                    </span>
                                  )}
                                </span>
                                {selected && (
                                  <span
                                    className={`${
                                      active ? 'text-white' : 'text-indigo-600'
                                    } absolute inset-y-0 left-0 flex items-center pl-1.5`}
                                  >
                                    <CheckIcon className="h-5 w-5" />
                                  </span>
                                )}
                              </div>
                            )}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Transition>
                  </div>
                </>
              )}
            </Listbox>
          )}
        {isAnime && (
          <div className="mt-4 italic">
            {intl.formatMessage(messages.animenote)}
          </div>
        )}
      </div>
    </>
  );
};

export default AdvancedRequester;
