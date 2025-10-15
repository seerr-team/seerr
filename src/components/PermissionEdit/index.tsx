import type { PermissionItem } from '@app/components/PermissionOption';
import PermissionOption from '@app/components/PermissionOption';
import useSettings from '@app/hooks/useSettings';
import type { User } from '@app/hooks/useUser';
import { Permission } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { MediaServerType } from '@server/constants/server';
import { useIntl } from 'react-intl';

export const messages = defineMessages('components.PermissionEdit', {
  admin: 'Admin',
  adminDescription:
    'Full administrator access. Bypasses all other permission checks.',
  users: 'Manage Users',
  usersDescription:
    'Grant permission to manage users. Users with this permission cannot modify users with or grant the Admin privilege.',
  managerequests: 'Manage Requests',
  managerequestsDescription:
    'Grant permission to manage media requests. All requests made by a user with this permission will be automatically approved.',
  request: 'Request',
  requestDescription: 'Grant permission to submit requests for non-4K media.',
  requestMovies: 'Request Movies',
  requestMoviesDescription:
    'Grant permission to submit requests for non-4K movies.',
  requestTv: 'Request Series',
  requestTvDescription:
    'Grant permission to submit requests for non-4K series.',
  requestMusic: 'Request Music',
  requestMusicDescription:
    'Grant permission to submit requests for music albums.',
  autoapprove: 'Auto-Approve',
  autoapproveDescription:
    'Grant automatic approval for all non-4K media requests.',
  autoapproveMovies: 'Auto-Approve Movies',
  autoapproveMoviesDescription:
    'Grant automatic approval for non-4K movie requests.',
  autoapproveSeries: 'Auto-Approve Series',
  autoapproveSeriesDescription:
    'Grant automatic approval for non-4K series requests.',
  autoapproveMusic: 'Auto-Approve Music',
  autoapproveMusicDescription:
    'Grant automatic approval for music album requests.',
  autoapprove4k: 'Auto-Approve 4K',
  autoapprove4kDescription:
    'Grant automatic approval for all 4K media requests.',
  autoapprove4kMovies: 'Auto-Approve 4K Movies',
  autoapprove4kMoviesDescription:
    'Grant automatic approval for 4K movie requests.',
  autoapprove4kSeries: 'Auto-Approve 4K Series',
  autoapprove4kSeriesDescription:
    'Grant automatic approval for 4K series requests.',
  request4k: 'Request 4K',
  request4kDescription: 'Grant permission to submit requests for 4K media.',
  request4kMovies: 'Request 4K Movies',
  request4kMoviesDescription:
    'Grant permission to submit requests for 4K movies.',
  request4kTv: 'Request 4K Series',
  request4kTvDescription: 'Grant permission to submit requests for 4K series.',
  advancedrequest: 'Advanced Requests',
  advancedrequestDescription:
    'Grant permission to modify advanced media request options.',
  autorequest: 'Auto-Request',
  autorequestDescription:
    'Grant permission to automatically submit requests for non-4K media via Plex Watchlist.',
  autorequestMovies: 'Auto-Request Movies',
  autorequestMoviesDescription:
    'Grant permission to automatically submit requests for non-4K movies via Plex Watchlist.',
  autorequestSeries: 'Auto-Request Series',
  autorequestSeriesDescription:
    'Grant permission to automatically submit requests for non-4K series via Plex Watchlist.',
  autorequestMusic: 'Auto-Request Music',
  autorequestMusicDescription:
    'Grant permission to automatically submit requests for music via Plex Watchlist.',
  viewrequests: 'View Requests',
  viewrequestsDescription:
    'Grant permission to view media requests submitted by other users.',
  manageissues: 'Manage Issues',
  manageissuesDescription: 'Grant permission to manage media issues.',
  createissues: 'Report Issues',
  createissuesDescription: 'Grant permission to report media issues.',
  viewissues: 'View Issues',
  viewissuesDescription:
    'Grant permission to view media issues reported by other users.',
  viewrecent: 'View Recently Added',
  viewrecentDescription:
    'Grant permission to view the list of recently added media.',
  viewwatchlists: 'View {mediaServerName} Watchlists',
  viewwatchlistsDescription:
    "Grant permission to view other users' {mediaServerName} Watchlists.",
  manageblacklist: 'Manage Blacklist',
  manageblacklistDescription: 'Grant permission to manage blacklisted media.',
  blacklistedItems: 'Blacklist media.',
  blacklistedItemsDescription: 'Grant permission to blacklist media.',
  viewblacklistedItems: 'View blacklisted media.',
  viewblacklistedItemsDescription:
    'Grant permission to view blacklisted media.',
});

interface PermissionEditProps {
  actingUser?: User;
  currentUser?: User;
  currentPermission: number;
  onUpdate: (newPermissions: number) => void;
}

export const PermissionEdit = ({
  actingUser,
  currentUser,
  currentPermission,
  onUpdate,
}: PermissionEditProps) => {
  const intl = useIntl();
  const settings = useSettings();

  const permissionList: PermissionItem[] = [
    {
      id: 'admin',
      name: intl.formatMessage(messages.admin),
      description: intl.formatMessage(messages.adminDescription),
      permission: Permission.ADMIN,
    },
    {
      id: 'users',
      name: intl.formatMessage(messages.users),
      description: intl.formatMessage(messages.usersDescription),
      permission: Permission.MANAGE_USERS,
    },
    {
      id: 'managerequest',
      name: intl.formatMessage(messages.managerequests),
      description: intl.formatMessage(messages.managerequestsDescription),
      permission: Permission.MANAGE_REQUESTS,
      children: [
        {
          id: 'advancedrequest',
          name: intl.formatMessage(messages.advancedrequest),
          description: intl.formatMessage(messages.advancedrequestDescription),
          permission: Permission.REQUEST_ADVANCED,
        },
        {
          id: 'viewrequests',
          name: intl.formatMessage(messages.viewrequests),
          description: intl.formatMessage(messages.viewrequestsDescription),
          permission: Permission.REQUEST_VIEW,
        },
        {
          id: 'viewrecent',
          name: intl.formatMessage(messages.viewrecent),
          description: intl.formatMessage(messages.viewrecentDescription),
          permission: Permission.RECENT_VIEW,
        },
        {
          id: 'viewwatchlists',
          name: intl.formatMessage(messages.viewwatchlists, {
            mediaServerName:
              settings.currentSettings.mediaServerType === MediaServerType.PLEX
                ? 'Plex'
                : settings.currentSettings.mediaServerType ===
                  MediaServerType.JELLYFIN
                ? 'Jellyfin'
                : 'Emby',
          }),
          description: intl.formatMessage(messages.viewwatchlistsDescription, {
            mediaServerName:
              settings.currentSettings.mediaServerType === MediaServerType.PLEX
                ? 'Plex'
                : settings.currentSettings.mediaServerType ===
                  MediaServerType.JELLYFIN
                ? 'Jellyfin'
                : 'Emby',
          }),
          permission: Permission.WATCHLIST_VIEW,
        },
      ],
    },
    {
      id: 'request',
      name: intl.formatMessage(messages.request),
      description: intl.formatMessage(messages.requestDescription),
      permission: Permission.REQUEST,
      children: [
        {
          id: 'request-movies',
          name: intl.formatMessage(messages.requestMovies),
          description: intl.formatMessage(messages.requestMoviesDescription),
          permission: Permission.REQUEST_MOVIE,
        },
        {
          id: 'request-tv',
          name: intl.formatMessage(messages.requestTv),
          description: intl.formatMessage(messages.requestTvDescription),
          permission: Permission.REQUEST_TV,
        },
        {
          id: 'request-music',
          name: intl.formatMessage(messages.requestMusic),
          description: intl.formatMessage(messages.requestMusicDescription),
          permission: Permission.REQUEST_MUSIC,
        },
      ],
    },
    {
      id: 'autoapprove',
      name: intl.formatMessage(messages.autoapprove),
      description: intl.formatMessage(messages.autoapproveDescription),
      permission: Permission.AUTO_APPROVE,
      requires: [{ permissions: [Permission.REQUEST] }],
      children: [
        {
          id: 'autoapprovemovies',
          name: intl.formatMessage(messages.autoapproveMovies),
          description: intl.formatMessage(
            messages.autoapproveMoviesDescription
          ),
          permission: Permission.AUTO_APPROVE_MOVIE,
          requires: [
            {
              permissions: [Permission.REQUEST, Permission.REQUEST_MOVIE],
              type: 'or',
            },
          ],
        },
        {
          id: 'autoapprovetv',
          name: intl.formatMessage(messages.autoapproveSeries),
          description: intl.formatMessage(
            messages.autoapproveSeriesDescription
          ),
          permission: Permission.AUTO_APPROVE_TV,
          requires: [
            {
              permissions: [Permission.REQUEST, Permission.REQUEST_TV],
              type: 'or',
            },
          ],
        },
        {
          id: 'autoapprovemusic',
          name: intl.formatMessage(messages.autoapproveMusic),
          description: intl.formatMessage(messages.autoapproveMusicDescription),
          permission: Permission.AUTO_APPROVE_MUSIC,
          requires: [
            {
              permissions: [Permission.REQUEST, Permission.REQUEST_MUSIC],
              type: 'or',
            },
          ],
        },
      ],
    },
    {
      id: 'autorequest',
      name: intl.formatMessage(messages.autorequest),
      description: intl.formatMessage(messages.autorequestDescription),
      permission: Permission.AUTO_REQUEST,
      requires: [{ permissions: [Permission.REQUEST] }],
      children: [
        {
          id: 'autorequestmovies',
          name: intl.formatMessage(messages.autorequestMovies),
          description: intl.formatMessage(
            messages.autorequestMoviesDescription
          ),
          permission: Permission.AUTO_REQUEST_MOVIE,
          requires: [
            {
              permissions: [Permission.REQUEST, Permission.REQUEST_MOVIE],
              type: 'or',
            },
          ],
        },
        {
          id: 'autorequesttv',
          name: intl.formatMessage(messages.autorequestSeries),
          description: intl.formatMessage(
            messages.autorequestSeriesDescription
          ),
          permission: Permission.AUTO_REQUEST_TV,
          requires: [
            {
              permissions: [Permission.REQUEST, Permission.REQUEST_TV],
              type: 'or',
            },
          ],
        },
        {
          id: 'autorequestmusic',
          name: intl.formatMessage(messages.autorequestMusic),
          description: intl.formatMessage(messages.autorequestMusicDescription),
          permission: Permission.AUTO_REQUEST_MUSIC,
          requires: [
            {
              permissions: [Permission.REQUEST, Permission.REQUEST_MUSIC],
              type: 'or',
            },
          ],
        },
      ],
    },
    {
      id: 'request4k',
      name: intl.formatMessage(messages.request4k),
      description: intl.formatMessage(messages.request4kDescription),
      permission: Permission.REQUEST_4K,
      children: [
        {
          id: 'request4k-movies',
          name: intl.formatMessage(messages.request4kMovies),
          description: intl.formatMessage(messages.request4kMoviesDescription),
          permission: Permission.REQUEST_4K_MOVIE,
        },
        {
          id: 'request4k-tv',
          name: intl.formatMessage(messages.request4kTv),
          description: intl.formatMessage(messages.request4kTvDescription),
          permission: Permission.REQUEST_4K_TV,
        },
      ],
    },
    {
      id: 'autoapprove4k',
      name: intl.formatMessage(messages.autoapprove4k),
      description: intl.formatMessage(messages.autoapprove4kDescription),
      permission: Permission.AUTO_APPROVE_4K,
      requires: [
        {
          permissions: [Permission.REQUEST_4K],
        },
      ],
      children: [
        {
          id: 'autoapprove4k-movies',
          name: intl.formatMessage(messages.autoapprove4kMovies),
          description: intl.formatMessage(
            messages.autoapprove4kMoviesDescription
          ),
          permission: Permission.AUTO_APPROVE_4K_MOVIE,
          requires: [
            {
              permissions: [Permission.REQUEST_4K, Permission.REQUEST_4K_MOVIE],
              type: 'or',
            },
          ],
        },
        {
          id: 'autoapprove4k-tv',
          name: intl.formatMessage(messages.autoapprove4kSeries),
          description: intl.formatMessage(
            messages.autoapprove4kSeriesDescription
          ),
          permission: Permission.AUTO_APPROVE_4K_TV,
          requires: [
            {
              permissions: [Permission.REQUEST_4K, Permission.REQUEST_4K_TV],
              type: 'or',
            },
          ],
        },
      ],
    },
    {
      id: 'manageissues',
      name: intl.formatMessage(messages.manageissues),
      description: intl.formatMessage(messages.manageissuesDescription),
      permission: Permission.MANAGE_ISSUES,
      children: [
        {
          id: 'createissues',
          name: intl.formatMessage(messages.createissues),
          description: intl.formatMessage(messages.createissuesDescription),
          permission: Permission.CREATE_ISSUES,
        },
        {
          id: 'viewissues',
          name: intl.formatMessage(messages.viewissues),
          description: intl.formatMessage(messages.viewissuesDescription),
          permission: Permission.VIEW_ISSUES,
        },
      ],
    },
    {
      id: 'manageblacklist',
      name: intl.formatMessage(messages.manageblacklist),
      description: intl.formatMessage(messages.manageblacklistDescription),
      permission: Permission.MANAGE_BLACKLIST,
      children: [
        {
          id: 'viewblacklisteditems',
          name: intl.formatMessage(messages.viewblacklistedItems),
          description: intl.formatMessage(
            messages.viewblacklistedItemsDescription
          ),
          permission: Permission.VIEW_BLACKLIST,
        },
      ],
    },
  ];

  return (
    <>
      {permissionList.map((permissionItem) => (
        <PermissionOption
          key={`permission-option-${permissionItem.id}`}
          option={permissionItem}
          actingUser={actingUser}
          currentUser={currentUser}
          currentPermission={currentPermission}
          onUpdate={(newPermission) => onUpdate(newPermission)}
        />
      ))}
    </>
  );
};

export default PermissionEdit;
