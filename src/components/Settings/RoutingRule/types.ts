export interface RoutingRule {
  id: number;
  serviceType: 'radarr' | 'sonarr';
  isFallback: boolean;
  is4k: boolean;
  priority: number;
  name: string;
  users?: string | null;
  genres?: string | null;
  languages?: string | null;
  keywords?: string | null;
  targetServiceId: number;
  activeProfileId?: number | null;
  activeProfileName: string | null;
  rootFolder?: string | null;
  seriesType?: string | null;
  tags?: string | null;
  minimumAvailability?: 'announced' | 'inCinemas' | 'released' | null;
  createdAt: string;
  updatedAt: string;
}

export type RoutingRuleResultsResponse = RoutingRule[];
