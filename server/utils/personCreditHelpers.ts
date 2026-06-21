import type { PersonCredit } from '@server/models/Person';
import { groupBy } from 'lodash';

export type PersonCreditSort =
  | 'releaseDate.desc'
  | 'releaseDate.asc'
  | 'title.asc'
  | 'title.desc'
  | 'voteCount.desc'
  | 'voteCount.asc';

export const DEFAULT_PERSON_CREDIT_SORT: PersonCreditSort = 'voteCount.desc';

const getReleaseDate = (credit: PersonCredit): string =>
  credit.mediaType === 'movie' ? credit.releaseDate : credit.firstAirDate;

const getTitle = (credit: PersonCredit): string =>
  credit.mediaType === 'movie'
    ? credit.originalTitle || credit.title
    : credit.originalName || credit.name;

const compareStrings = (
  a: string,
  b: string,
  direction: 'asc' | 'desc'
): number => {
  const result = (a || '').localeCompare(b || '', undefined, {
    sensitivity: 'base',
  });

  return direction === 'asc' ? result : -result;
};

const compareNumbers = (
  a: number,
  b: number,
  direction: 'asc' | 'desc'
): number => {
  const result = a - b;

  return direction === 'asc' ? result : -result;
};

export const sortPersonCredits = <T extends PersonCredit>(
  credits: T[],
  sort: PersonCreditSort,
  groupKey: (credit: T) => string | number,
  mergeGrouped: (objs: T[]) => T
): T[] => {
  const grouped = groupBy(credits, groupKey);
  const items = Object.values(grouped).map(mergeGrouped);
  const [field, direction] = sort.split('.') as [string, 'asc' | 'desc'];

  return [...items].sort((a, b) => {
    switch (field) {
      case 'releaseDate': {
        const aDate = getReleaseDate(a);
        const bDate = getReleaseDate(b);

        if (!aDate && !bDate) {
          return 0;
        }

        if (!aDate) {
          return 1;
        }

        if (!bDate) {
          return -1;
        }

        return compareStrings(aDate, bDate, direction);
      }
      case 'title':
        return compareStrings(getTitle(a), getTitle(b), direction);
      case 'voteCount':
        return compareNumbers(a.voteCount ?? 0, b.voteCount ?? 0, direction);
      default:
        return 0;
    }
  });
};
