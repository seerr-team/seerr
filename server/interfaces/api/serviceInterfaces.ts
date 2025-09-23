import type { QualityProfile, RootFolder, Tag } from '@server/api/servarr/base';
import type { MetadataProfile } from '@server/api/servarr/readarr';
import type { LanguageProfile } from '@server/api/servarr/sonarr';

export interface ServiceCommonServer {
  id: number;
  name: string;
  isAlt?: boolean;
  isDefault: boolean;
  activeProfileId: number;
  activeDirectory: string;
  activeLanguageProfileId?: number;
  activeAnimeProfileId?: number;
  activeAnimeDirectory?: string;
  activeAnimeLanguageProfileId?: number;
  activeMetadataProfileId?: number;
  activeTags: number[];
  activeAnimeTags?: number[];
}

export interface ServiceCommonServerWithDetails {
  server: ServiceCommonServer;
  profiles: QualityProfile[];
  rootFolders: Partial<RootFolder>[];
  languageProfiles?: LanguageProfile[];
  metadataProfiles?: MetadataProfile[];
  tags: Tag[];
}
