import {
  isDefaultBrandList,
  parseBrandList,
  serializeBrandList,
  type DiscoverBrand,
} from '@app/components/Discover/brandLists';

export type DiscoverStudio = DiscoverBrand;

export const defaultDiscoverStudios: DiscoverStudio[] = [
  { id: 2, name: 'Disney', logoPath: '/wdrCwmRnLFJhEoH8GSfymY85KHT.png' },
  {
    id: 127928,
    name: '20th Century Studios',
    logoPath: '/h0rjX5vjW5r8yEnUBStFarjcLT4.png',
  },
  {
    id: 34,
    name: 'Sony Pictures',
    logoPath: '/GagSvqWlyPdkFHMfQ3pNq6ix9P.png',
  },
  {
    id: 174,
    name: 'Warner Bros. Pictures',
    logoPath: '/ky0xOc5OrhzkZ1N6KyUxacfQsCk.png',
  },
  { id: 33, name: 'Universal', logoPath: '/8lvHyhjr8oUKOOy2dKXoALWKdp0.png' },
  { id: 4, name: 'Paramount', logoPath: '/fycMZt242LVjagMByZOLUGbCvv3.png' },
  { id: 3, name: 'Pixar', logoPath: '/1TjvGVDMYsj6JBxOAkUHpPEwLf7.png' },
  { id: 521, name: 'Dreamworks', logoPath: '/kP7t6RwGz2AvvTkvnI1uteEwHet.png' },
  {
    id: 420,
    name: 'Marvel Studios',
    logoPath: '/hUzeosd33nzE5MCNsZxCGEKTXaQ.png',
  },
  { id: 9993, name: 'DC', logoPath: '/2Tc1P3Ac8M479naPp1kYT3izLS5.png' },
  { id: 41077, name: 'A24', logoPath: '/1ZXsGaFPgrgS6ZZGS37AqD5uU12.png' },
];

export const parseDiscoverStudios = (data?: string | null): DiscoverStudio[] =>
  parseBrandList(data, defaultDiscoverStudios);

export const isDefaultDiscoverStudios = (studios: DiscoverStudio[]): boolean =>
  isDefaultBrandList(studios, defaultDiscoverStudios);

export const serializeDiscoverStudios = (
  studios: DiscoverStudio[]
): string | null => serializeBrandList(studios, defaultDiscoverStudios);
