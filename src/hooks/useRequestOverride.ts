import type { MediaRequest } from '@server/entity/MediaRequest';
import type {
  ServiceCommonServer,
  ServiceCommonServerWithDetails,
} from '@server/interfaces/api/serviceInterfaces';
import useSWR from 'swr';

interface OverrideStatus {
  server?: string;
  profile?: string;
  rootFolder?: string;
  languageProfile?: string;
}

const useRequestOverride = (request: MediaRequest): OverrideStatus => {
  const serviceType =
    request.type === 'movie'
      ? 'radarr'
      : request.type === 'tv'
      ? 'sonarr'
      : 'lidarr';

  const { data: allServers } = useSWR<ServiceCommonServer[]>(
    `/api/v1/service/${serviceType}`
  );

  const { data } = useSWR<ServiceCommonServerWithDetails>(
    `/api/v1/service/${serviceType}/${request.serverId}`
  );

  if (!data || !allServers) {
    return {};
  }

  const defaultServer = allServers.find((server) =>
    request.type === 'music'
      ? server.isDefault
      : server.is4k === request.is4k && server.isDefault
  );

  const activeServer = allServers.find(
    (server) => server.id === request.serverId
  );

  return {
    server:
      activeServer && request.serverId !== defaultServer?.id
        ? activeServer.name
        : undefined,
    profile:
      defaultServer?.activeProfileId !== request.profileId
        ? data.profiles.find((profile) => profile.id === request.profileId)
            ?.name
        : undefined,
    rootFolder:
      defaultServer?.activeDirectory !== request.rootFolder
        ? request.rootFolder
        : undefined,
    languageProfile:
      request.type === 'tv' &&
      defaultServer?.activeLanguageProfileId !== request.languageProfileId
        ? data.languageProfiles?.find(
            (profile) => profile.id === request.languageProfileId
          )?.name
        : undefined,
  };
};

export default useRequestOverride;
