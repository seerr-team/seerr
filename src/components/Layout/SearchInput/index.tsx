import useSearchInput from '@app/hooks/useSearchInput';
import defineMessages from '@app/utils/defineMessages';
import {
  BookOpenIcon,
  ChevronDownIcon,
  FilmIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Layout.SearchInput', {
  searchPlaceholder: 'Search Movies & TV',
  searchPlaceholderBooks: 'Search Books',
  mediaTypeLabel: 'Media Type',
  moviesAndTv: 'Movies & TV',
  books: 'Books',
});

const SearchInput = () => {
  const intl = useIntl();
  const {
    searchValue,
    setSearchValue,
    setIsOpen,
    clear,
    searchType,
    setSearchType,
  } = useSearchInput();
  const router = useRouter();
  return (
    <div className="flex flex-1">
      <label htmlFor="search_field" className="sr-only">
        Search
      </label>
      <div className="flex w-full">
        <div className="relative -mr-px grid shrink-0 grid-cols-1 focus-within:relative">
          <div className="pointer-events-none z-20 col-start-1 row-start-1 ml-3 flex items-center self-center">
            {searchType === 'hardcover' ? (
              <BookOpenIcon className="h-5 w-5 text-gray-300" />
            ) : (
              <FilmIcon className="h-5 w-5 text-gray-300" />
            )}
          </div>
          <select
            value={searchType}
            onChange={(e) => {
              const newType = e.target.value;
              setSearchType(newType);
              if (router.pathname.startsWith('/search')) {
                router.replace({
                  pathname: '/search',
                  query: { ...router.query, type: newType },
                });
              }
            }}
            aria-label={intl.formatMessage(messages.mediaTypeLabel)}
            style={{
              backgroundImage: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              color: 'transparent',
            }}
            className="col-start-1 row-start-1 w-14 cursor-pointer rounded-l-full border border-gray-600 bg-gray-700 py-2 pl-8 pr-4 text-sm focus:z-10 focus:border-gray-500 focus:outline-none"
          >
            <option value="tmdb" className="bg-gray-800 text-white">
              {intl.formatMessage(messages.moviesAndTv)}
            </option>
            <option value="hardcover" className="bg-gray-800 text-white">
              {intl.formatMessage(messages.books)}
            </option>
          </select>
          <div className="pointer-events-none z-20 col-start-1 row-start-1 mr-2 flex items-center self-center justify-self-end">
            <ChevronDownIcon className="h-3 w-3 text-white" />
          </div>
        </div>
        <div className="relative grid grow grid-cols-1 focus-within:relative">
          <input
            id="search_field"
            style={{ paddingRight: searchValue.length > 0 ? '1.75rem' : '' }}
            className="col-start-1 row-start-1 block w-full rounded-r-full border border-gray-600 bg-gray-900 bg-opacity-80 py-2 pl-4 pr-3 text-white placeholder-gray-300 outline-none hover:border-gray-500 focus:border-gray-500 focus:bg-opacity-100 focus:placeholder-gray-400 focus:outline-none sm:text-base"
            placeholder={
              searchType === 'hardcover'
                ? intl.formatMessage(messages.searchPlaceholderBooks)
                : intl.formatMessage(messages.searchPlaceholder)
            }
            type="search"
            autoComplete="off"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              if (searchValue === '') {
                setIsOpen(false);
              }
            }}
            onKeyUp={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          {searchValue.length > 0 && (
            <button
              className="absolute inset-y-0 right-2 m-auto h-7 w-7 border-none p-1 text-gray-400 outline-none transition hover:text-white focus:border-none focus:outline-none"
              onClick={() => clear()}
            >
              <XCircleIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchInput;
