import type { PlexSettings } from '@server/interfaces/settings';

export interface PlexStatus {
  settings: PlexSettings;
  status: number;
  message: string;
}

export interface PlexConnection {
  protocol: string;
  address: string;
  port: number;
  uri: string;
  local: boolean;
  status?: number;
  message?: string;
}

export interface PlexDevice {
  name: string;
  product: string;
  productVersion: string;
  platform: string;
  platformVersion: string;
  device: string;
  clientIdentifier: string;
  createdAt: Date;
  lastSeenAt: Date;
  provides: string[];
  owned: boolean;
  accessToken?: string;
  publicAddress?: string;
  httpsRequired?: boolean;
  synced?: boolean;
  relay?: boolean;
  dnsRebindingProtection?: boolean;
  natLoopbackSupported?: boolean;
  publicAddressMatches?: boolean;
  presence?: boolean;
  ownerID?: string;
  home?: boolean;
  sourceTitle?: string;
  connection: PlexConnection[];
}
