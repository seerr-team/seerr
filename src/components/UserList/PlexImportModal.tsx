import Alert from '@app/components/Common/Alert';
import Modal from '@app/components/Common/Modal';
import useSettings from '@app/hooks/useSettings';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import axios from 'axios';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

interface PlexImportProps {
  onCancel?: () => void;
  onComplete?: () => void;
}

const messages = defineMessages('components.UserList', {
  importfromplex: 'Import Plex Users & Profiles',
  importfromplexerror:
    'Something went wrong while importing Plex users and profiles.',
  user: 'User',
  profile: 'Profile',
  nouserstoimport: 'There are no Plex users or profiles to import.',
  newplexsigninenabled:
    'The <strong>Enable New Plex Sign-In</strong> setting is currently enabled. Plex users with library access do not need to be imported in order to sign in.',
  possibleDuplicate: 'Possible duplicate',
  duplicateUserWarning:
    'This user appears to be a duplicate of an existing user or profile.',
  duplicateProfileWarning:
    'This profile appears to be a duplicate of an existing user or profile.',
  importSuccess:
    '{count, plural, one {# item was} other {# items were}} imported successfully.',
  importSuccessUsers:
    '{count, plural, one {# user was} other {# users were}} imported successfully.',
  importSuccessProfiles:
    '{count, plural, one {# profile was} other {# profiles were}} imported successfully.',
  importSuccessMixed:
    '{userCount, plural, one {# user} other {# users}} and {profileCount, plural, one {# profile} other {# profiles}} were imported successfully.',
  skippedUsersDuplicates:
    '{count, plural, one {# user was} other {# users were}} skipped due to duplicates.',
  skippedProfilesDuplicates:
    '{count, plural, one {# profile was} other {# profiles were}} skipped due to duplicates.',
});

const PlexImportModal = ({ onCancel, onComplete }: PlexImportProps) => {
  const intl = useIntl();
  const settings = useSettings();
  const { addToast } = useToasts();
  const [isImporting, setImporting] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [duplicateMap, setDuplicateMap] = useState<{
    [key: string]: { type: 'user' | 'profile'; duplicateWith: string[] };
  }>({});

  const { data, error } = useSWR<{
    users: {
      id: string;
      title: string;
      username: string;
      email: string;
      thumb: string;
    }[];
    profiles: {
      id: string;
      title: string;
      username?: string;
      thumb: string;
      isMainUser?: boolean;
      protected?: boolean;
    }[];
  }>('/api/v1/settings/plex/users', {
    revalidateOnMount: true,
  });

  useEffect(() => {
    if (data) {
      const duplicates: {
        [key: string]: { type: 'user' | 'profile'; duplicateWith: string[] };
      } = {};

      const usernameMap = new Map<string, string>();

      data.users.forEach((user) => {
        usernameMap.set(user.username.toLowerCase(), user.id);
      });

      data.profiles.forEach((profile) => {
        const profileName = (profile.username || profile.title).toLowerCase();

        if (usernameMap.has(profileName)) {
          const userId = usernameMap.get(profileName);

          duplicates[`profile-${profile.id}`] = {
            type: 'profile',
            duplicateWith: [`user-${userId}`],
          };

          duplicates[`user-${userId}`] = {
            type: 'user',
            duplicateWith: [`profile-${profile.id}`],
          };
        }
      });

      setDuplicateMap(duplicates);
    }
  }, [data]);

  const importUsers = async () => {
    setImporting(true);

    try {
      const { data: response } = await axios.post(
        '/api/v1/user/import-from-plex',
        {
          plexIds: selectedUsers,
          profileIds: selectedProfiles,
        }
      );

      if (response.data) {
        const importedUsers = response.data.filter(
          (item: { isPlexProfile: boolean }) => !item.isPlexProfile
        ).length;
        const importedProfiles = response.data.filter(
          (item: { isPlexProfile: boolean }) => item.isPlexProfile
        ).length;

        let successMessage;
        if (importedUsers > 0 && importedProfiles > 0) {
          successMessage = intl.formatMessage(messages.importSuccessMixed, {
            userCount: importedUsers,
            profileCount: importedProfiles,
          });
        } else if (importedUsers > 0) {
          successMessage = intl.formatMessage(messages.importSuccessUsers, {
            count: importedUsers,
          });
        } else if (importedProfiles > 0) {
          successMessage = intl.formatMessage(messages.importSuccessProfiles, {
            count: importedProfiles,
          });
        } else {
          successMessage = intl.formatMessage(messages.importSuccess, {
            count: response.data.length,
          });
        }

        let finalMessage = successMessage;

        if (response.skipped && response.skipped.length > 0) {
          const skippedUsers = response.skipped.filter(
            (item: { type: string }) => item.type === 'user'
          ).length;
          const skippedProfiles = response.skipped.filter(
            (item: { type: string }) => item.type === 'profile'
          ).length;

          let skippedMessage = '';
          if (skippedUsers > 0) {
            skippedMessage += intl.formatMessage(
              messages.skippedUsersDuplicates,
              {
                count: skippedUsers,
              }
            );
          }

          if (skippedProfiles > 0) {
            if (skippedMessage) skippedMessage += ' ';
            skippedMessage += intl.formatMessage(
              messages.skippedProfilesDuplicates,
              {
                count: skippedProfiles,
              }
            );
          }

          finalMessage += ` ${skippedMessage}`;
        }

        addToast(finalMessage, {
          autoDismiss: true,
          appearance: 'success',
        });

        if (onComplete) {
          onComplete();
        }
      } else {
        throw new Error('Invalid response format');
      }
    } catch (e) {
      addToast(intl.formatMessage(messages.importfromplexerror), {
        autoDismiss: true,
        appearance: 'error',
      });
    } finally {
      setImporting(false);
    }
  };

  const isSelectedUser = (plexId: string): boolean =>
    selectedUsers.includes(plexId);

  const isSelectedProfile = (plexId: string): boolean =>
    selectedProfiles.includes(plexId);

  const isDuplicate = (type: 'user' | 'profile', id: string): boolean => {
    const key = `${type}-${id}`;
    return !!duplicateMap[key];
  };

  const isDuplicateWithSelected = (
    type: 'user' | 'profile',
    id: string
  ): boolean => {
    const key = `${type}-${id}`;
    if (!duplicateMap[key]) return false;

    return duplicateMap[key].duplicateWith.some((dup) => {
      if (dup.startsWith('user-')) {
        const userId = dup.replace('user-', '');
        return selectedUsers.includes(userId);
      } else if (dup.startsWith('profile-')) {
        const profileId = dup.replace('profile-', '');
        return selectedProfiles.includes(profileId);
      }
      return false;
    });
  };

  const hasSelectedDuplicate = (
    type: 'user' | 'profile',
    id: string
  ): boolean => {
    if (type === 'user' && selectedUsers.includes(id)) {
      return isDuplicateWithSelected('user', id);
    } else if (type === 'profile' && selectedProfiles.includes(id)) {
      return isDuplicateWithSelected('profile', id);
    }
    return false;
  };

  const isAllUsers = (): boolean =>
    data?.users && data.users.length > 0
      ? selectedUsers.length === data.users.length
      : false;

  const isAllProfiles = (): boolean =>
    data?.profiles && data.profiles.length > 0
      ? selectedProfiles.length === data.profiles.length
      : false;

  const toggleUser = (plexId: string): void => {
    if (selectedUsers.includes(plexId)) {
      setSelectedUsers((users: string[]) =>
        users.filter((user: string) => user !== plexId)
      );
    } else {
      const willCreateDuplicate = isDuplicateWithSelected('user', plexId);

      if (willCreateDuplicate) {
        addToast(intl.formatMessage(messages.duplicateUserWarning), {
          autoDismiss: true,
          appearance: 'warning',
        });
      }

      setSelectedUsers((users: string[]) => [...users, plexId]);
    }
  };

  const toggleProfile = (plexId: string): void => {
    if (selectedProfiles.includes(plexId)) {
      setSelectedProfiles((profiles: string[]) =>
        profiles.filter((profile: string) => profile !== plexId)
      );
    } else {
      const willCreateDuplicate = isDuplicateWithSelected('profile', plexId);

      if (willCreateDuplicate) {
        addToast(intl.formatMessage(messages.duplicateProfileWarning), {
          autoDismiss: true,
          appearance: 'warning',
        });
      }

      setSelectedProfiles((profiles: string[]) => [...profiles, plexId]);
    }
  };

  const toggleAllUsers = (): void => {
    if (data?.users && data.users.length > 0 && !isAllUsers()) {
      setSelectedUsers(data.users.map((user) => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const toggleAllProfiles = (): void => {
    if (data?.profiles && data.profiles.length > 0 && !isAllProfiles()) {
      setSelectedProfiles(data.profiles.map((profile) => profile.id));
    } else {
      setSelectedProfiles([]);
    }
  };

  const hasImportableContent =
    (data?.users && data.users.length > 0) ||
    (data?.profiles && data.profiles.length > 0);

  const hasSelectedContent =
    selectedUsers.length > 0 || selectedProfiles.length > 0;

  return (
    <Modal
      loading={!data && !error}
      title={intl.formatMessage(messages.importfromplex)}
      onOk={() => {
        importUsers();
      }}
      okDisabled={isImporting || !hasSelectedContent}
      okText={intl.formatMessage(
        isImporting ? globalMessages.importing : globalMessages.import
      )}
      onCancel={onCancel}
    >
      {hasImportableContent ? (
        <>
          {settings.currentSettings.newPlexLogin && (
            <Alert
              title={intl.formatMessage(messages.newplexsigninenabled, {
                strong: (msg: React.ReactNode) => (
                  <strong className="font-semibold text-white">{msg}</strong>
                ),
              })}
              type="info"
            />
          )}

          {/* Plex Users Section */}
          {data?.users && data.users.length > 0 && (
            <div className="mb-6 flex flex-col">
              <h3 className="mb-2 text-lg font-medium">Plex Users</h3>
              <div className="-mx-4 sm:mx-0">
                <div className="inline-block min-w-full py-2 align-middle">
                  <div className="overflow-hidden shadow sm:rounded-lg">
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          <th className="w-16 bg-gray-500 px-4 py-3">
                            <span
                              role="checkbox"
                              tabIndex={0}
                              aria-checked={isAllUsers()}
                              onClick={() => toggleAllUsers()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Space') {
                                  toggleAllUsers();
                                }
                              }}
                              className="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center pt-2 focus:outline-none"
                            >
                              <span
                                aria-hidden="true"
                                className={`${
                                  isAllUsers() ? 'bg-indigo-500' : 'bg-gray-800'
                                } absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out`}
                              ></span>
                              <span
                                aria-hidden="true"
                                className={`${
                                  isAllUsers()
                                    ? 'translate-x-5'
                                    : 'translate-x-0'
                                } absolute left-0 inline-block h-5 w-5 rounded-full border border-gray-200 bg-white shadow transition-transform duration-200 ease-in-out group-focus:border-blue-300 group-focus:ring`}
                              ></span>
                            </span>
                          </th>
                          <th className="bg-gray-500 px-1 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200 md:px-6">
                            {intl.formatMessage(messages.user)}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700 bg-gray-600">
                        {data.users.map((user) => (
                          <tr
                            key={`user-${user.id}`}
                            className={
                              hasSelectedDuplicate('user', user.id)
                                ? 'bg-yellow-800/20'
                                : ''
                            }
                          >
                            <td className="whitespace-nowrap px-4 py-4 text-sm font-medium leading-5 text-gray-100">
                              <span
                                role="checkbox"
                                tabIndex={0}
                                aria-checked={isSelectedUser(user.id)}
                                onClick={() => toggleUser(user.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'Space') {
                                    toggleUser(user.id);
                                  }
                                }}
                                className="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center pt-2 focus:outline-none"
                              >
                                <span
                                  aria-hidden="true"
                                  className={`${
                                    isSelectedUser(user.id)
                                      ? 'bg-indigo-500'
                                      : 'bg-gray-800'
                                  } absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out`}
                                ></span>
                                <span
                                  aria-hidden="true"
                                  className={`${
                                    isSelectedUser(user.id)
                                      ? 'translate-x-5'
                                      : 'translate-x-0'
                                  } absolute left-0 inline-block h-5 w-5 rounded-full border border-gray-200 bg-white shadow transition-transform duration-200 ease-in-out group-focus:border-blue-300 group-focus:ring`}
                                ></span>
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-1 py-4 text-sm font-medium leading-5 text-gray-100 md:px-6">
                              <div className="flex items-center">
                                <Image
                                  className="h-10 w-10 flex-shrink-0 rounded-full"
                                  src={user.thumb}
                                  alt=""
                                  width={40}
                                  height={40}
                                />
                                <div className="ml-4">
                                  <div className="flex items-center text-base font-bold leading-5">
                                    {user.username}
                                    {isDuplicate('user', user.id) && (
                                      <span className="ml-2 rounded-full bg-yellow-600 px-2 py-0.5 text-xs font-normal">
                                        {intl.formatMessage(
                                          messages.possibleDuplicate
                                        )}
                                      </span>
                                    )}
                                  </div>
                                  {user.username &&
                                    user.username.toLowerCase() !==
                                      user.email && (
                                      <div className="text-sm leading-5 text-gray-300">
                                        {user.email}
                                      </div>
                                    )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Plex Profiles Section */}
          {data?.profiles && data.profiles.length > 0 && (
            <div className="flex flex-col">
              <h3 className="mb-2 text-lg font-medium">Plex Profiles</h3>
              <div className="-mx-4 sm:mx-0">
                <div className="inline-block min-w-full py-2 align-middle">
                  <div className="overflow-hidden shadow sm:rounded-lg">
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          <th className="w-16 bg-gray-500 px-4 py-3">
                            <span
                              role="checkbox"
                              tabIndex={0}
                              aria-checked={isAllProfiles()}
                              onClick={() => toggleAllProfiles()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Space') {
                                  toggleAllProfiles();
                                }
                              }}
                              className="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center pt-2 focus:outline-none"
                            >
                              <span
                                aria-hidden="true"
                                className={`${
                                  isAllProfiles()
                                    ? 'bg-indigo-500'
                                    : 'bg-gray-800'
                                } absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out`}
                              ></span>
                              <span
                                aria-hidden="true"
                                className={`${
                                  isAllProfiles()
                                    ? 'translate-x-5'
                                    : 'translate-x-0'
                                } absolute left-0 inline-block h-5 w-5 rounded-full border border-gray-200 bg-white shadow transition-transform duration-200 ease-in-out group-focus:border-blue-300 group-focus:ring`}
                              ></span>
                            </span>
                          </th>
                          <th className="bg-gray-500 px-1 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200 md:px-6">
                            {intl.formatMessage(messages.profile)}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700 bg-gray-600">
                        {data.profiles.map((profile) => (
                          <tr
                            key={`profile-${profile.id}`}
                            className={
                              hasSelectedDuplicate('profile', profile.id)
                                ? 'bg-yellow-800/20'
                                : ''
                            }
                          >
                            <td className="whitespace-nowrap px-4 py-4 text-sm font-medium leading-5 text-gray-100">
                              <span
                                role="checkbox"
                                tabIndex={0}
                                aria-checked={isSelectedProfile(profile.id)}
                                onClick={() => toggleProfile(profile.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'Space') {
                                    toggleProfile(profile.id);
                                  }
                                }}
                                className="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center pt-2 focus:outline-none"
                              >
                                <span
                                  aria-hidden="true"
                                  className={`${
                                    isSelectedProfile(profile.id)
                                      ? 'bg-indigo-500'
                                      : 'bg-gray-800'
                                  } absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out`}
                                ></span>
                                <span
                                  aria-hidden="true"
                                  className={`${
                                    isSelectedProfile(profile.id)
                                      ? 'translate-x-5'
                                      : 'translate-x-0'
                                  } absolute left-0 inline-block h-5 w-5 rounded-full border border-gray-200 bg-white shadow transition-transform duration-200 ease-in-out group-focus:border-blue-300 group-focus:ring`}
                                ></span>
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-1 py-4 text-sm font-medium leading-5 text-gray-100 md:px-6">
                              <div className="flex items-center">
                                <Image
                                  className="h-10 w-10 flex-shrink-0 rounded-full"
                                  src={profile.thumb}
                                  alt=""
                                  width={40}
                                  height={40}
                                />
                                <div className="ml-4">
                                  <div className="flex items-center text-base font-bold leading-5">
                                    {profile.title || profile.username}
                                    {isDuplicate('profile', profile.id) && (
                                      <span className="ml-2 rounded-full bg-yellow-600 px-2 py-0.5 text-xs font-normal">
                                        {intl.formatMessage(
                                          messages.possibleDuplicate
                                        )}
                                      </span>
                                    )}
                                  </div>
                                  {profile.protected && (
                                    <div className="text-sm leading-5 text-gray-300">
                                      (PIN protected)
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <Alert
          title={intl.formatMessage(messages.nouserstoimport)}
          type="info"
        />
      )}
    </Modal>
  );
};

export default PlexImportModal;
