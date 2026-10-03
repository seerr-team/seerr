import {
  DISCOVER_NETWORK_LOGO_PATH,
  discoverNetworksSchema,
} from '@server/constants/discover';

export interface DiscoverNetwork {
  id: number;
  name: string;
  logoPath: string;
}

export const isNetworkLogoPath = (logoPath: string): boolean =>
  DISCOVER_NETWORK_LOGO_PATH.test(logoPath);

export const networkLogoUrl = (logoPath: string): string =>
  `https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,bababa)${logoPath}`;

export const defaultDiscoverNetworks: DiscoverNetwork[] = [
  { id: 213, name: 'Netflix', logoPath: '/wwemzKWzjKYJFfCeiB57q3r4Bcm.png' },
  { id: 2739, name: 'Disney+', logoPath: '/gJ8VX6JSu3ciXHuC2dDGAo2lvwM.png' },
  {
    id: 1024,
    name: 'Prime Video',
    logoPath: '/ifhbNuuVnlwYy5oXA5VIb2YR8AZ.png',
  },
  { id: 2552, name: 'Apple TV+', logoPath: '/4KAy34EHvRM25Ih8wb82AuGU7zJ.png' },
  { id: 453, name: 'Hulu', logoPath: '/pqUTCleNUiTLAVlelGxUgWn1ELh.png' },
  { id: 49, name: 'HBO', logoPath: '/tuomPhY2UtuPTqqFnKMVHvSb724.png' },
  {
    id: 4353,
    name: 'Discovery+',
    logoPath: '/1D1bS3Dyw4ScYnFWTlBOvJXC3nb.png',
  },
  { id: 2, name: 'ABC', logoPath: '/ndAvF4JLsliGreX87jAc9GdjmJY.png' },
  { id: 19, name: 'FOX', logoPath: '/1DSpHrWyOORkL9N2QHX7Adt31mQ.png' },
  { id: 359, name: 'Cinemax', logoPath: '/6mSHSquNpfLgDdv6VnOOvC5Uz2h.png' },
  { id: 174, name: 'AMC', logoPath: '/pmvRmATOCaDykE6JrVoeYxlFHw3.png' },
  { id: 67, name: 'Showtime', logoPath: '/Allse9kbjiP6ExaQrnSpIhkurEi.png' },
  { id: 318, name: 'Starz', logoPath: '/8GJjw3HHsAJYwIWKIPBPfqMxlEa.png' },
  { id: 71, name: 'The CW', logoPath: '/ge9hzeaU7nMtQ4PjkFlc68dGAJ9.png' },
  { id: 6, name: 'NBC', logoPath: '/o3OedEP0f9mfZr33jz2BfXOUK5.png' },
  { id: 16, name: 'CBS', logoPath: '/nm8d7P7MJNiBLdgIzUK0gkuEA4r.png' },
  {
    id: 4330,
    name: 'Paramount+',
    logoPath: '/fi83B1oztoS47xxcemFdPMhIzK.png',
  },
  { id: 4, name: 'BBC One', logoPath: '/mVn7xESaTNmjBUyUtGNvDQd3CT1.png' },
  {
    id: 56,
    name: 'Cartoon Network',
    logoPath: '/c5OC6oVCg6QP4eqzW6XIq17CQjI.png',
  },
  { id: 80, name: 'Adult Swim', logoPath: '/9AKyspxVzywuaMuZ1Bvilu8sXly.png' },
  { id: 13, name: 'Nickelodeon', logoPath: '/ikZXxg6GnwpzqiZbRPhJGaZapqB.png' },
  { id: 3353, name: 'Peacock', logoPath: '/gIAcGTjKKr0KOHL5s4O36roJ8p7.png' },
];

export const parseDiscoverNetworks = (
  data?: string | null
): DiscoverNetwork[] => {
  if (!data) {
    return defaultDiscoverNetworks;
  }

  try {
    // The same schema the server uses, so names are trimmed and duplicate ids
    // are dropped here too
    const result = discoverNetworksSchema.safeParse(JSON.parse(data));

    return result.success ? result.data : defaultDiscoverNetworks;
  } catch {
    return defaultDiscoverNetworks;
  }
};

export const isDefaultDiscoverNetworks = (
  networks: DiscoverNetwork[]
): boolean =>
  networks.length === defaultDiscoverNetworks.length &&
  networks.every((network, index) => {
    const fallback = defaultDiscoverNetworks[index];

    return (
      network.id === fallback.id &&
      network.name === fallback.name &&
      network.logoPath === fallback.logoPath
    );
  });

export const serializeDiscoverNetworks = (
  networks: DiscoverNetwork[]
): string | null =>
  isDefaultDiscoverNetworks(networks) ? null : JSON.stringify(networks);
