import type { MediaType } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { NonFunctionProperties, PaginatedResponse } from './common';

export interface RequestResultsResponse extends PaginatedResponse {
  results: (NonFunctionProperties<MediaRequest> & {
    profileName?: string;
    metadataProfileName?: string;
    canRemove?: boolean;
  })[];
}

export type MediaRequestBody = {
  mediaType: MediaType;
  mediaId: number;
  tvdbId?: number;
  seasons?: number[] | 'all';
  isAlt?: boolean;
  serverId?: number;
  profileId?: number;
  metadataProfileId?: number;
  profileName?: string;
  rootFolder?: string;
  languageProfileId?: number;
  userId?: number;
  tags?: number[];
};
