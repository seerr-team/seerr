import MobileMenu from '@app/components/Layout/MobileMenu';
import PullToRefresh from '@app/components/Layout/PullToRefresh';
import SearchInput from '@app/components/Layout/SearchInput';
import Sidebar from '@app/components/Layout/Sidebar';
import UserDropdown from '@app/components/Layout/UserDropdown';
import useLocale from '@app/hooks/useLocale';
import useSettings from '@app/hooks/useSettings';
import { useUser } from '@app/hooks/useUser';
import { ArrowLeftIcon, Bars3BottomLeftIcon } from '@heroicons/react/24/solid';
import type { AvailableLocale } from '@server/types/languages';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import useSWR from 'swr';

type LayoutProps = {
  children: React.ReactNode;
};

const Layout = ({ children }: LayoutProps) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user } = useUser();
  const router = useRouter();
  const { currentSettings } = useSettings();
  const { setLocale } = useLocale();
  const { data: requestResponse, mutate: revalidateRequestsCount } = useSWR(
    '/api/v1/request/count',
    {
      revalidateOnMount: true,
    }
  );
  const { data: issueResponse, mutate: revalidateIssueCount } = useSWR(
    '/api/v1/issue/count',
    {
      revalidateOnMount: true,
    }
  );

  useEffect(() => {
    if (setLocale && user) {
      setLocale(
        (user?.settings?.locale
          ? user.settings.locale
          : currentSettings.locale) as AvailableLocale
      );
    }
  }, [setLocale, currentSettings.locale, user]);

  useEffect(() => {
    const updateScrolled = () => {
      if (window.pageYOffset > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', updateScrolled, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateScrolled);
    };
  }, []);

  return (
    <div className="flex h-full min-h-full min-w-0 bg-gray-900">
      <div className="pwa-only fixed inset-0 z-20 h-1 w-full border-gray-700 md:border-t" />
      <div className="absolute top-0 h-64 w-full bg-gradient-to-bl from-gray-800 to-gray-900">
        <div className="relative inset-0 h-full w-full bg-gradient-to-t from-gray-900 to-transparent" />
      </div>
      <Sidebar
        open={isSidebarOpen}
        setClosed={() => setSidebarOpen(false)}
        pendingRequestsCount={requestResponse?.pending ?? 0}
        openIssuesCount={issueResponse?.open ?? 0}
        revalidateIssueCount={() => revalidateIssueCount()}
        revalidateRequestsCount={() => revalidateRequestsCount()}
      />
      <div className="sm:hidden">
        <MobileMenu
          pendingRequestsCount={requestResponse?.pending ?? 0}
          openIssuesCount={issueResponse?.open ?? 0}
          revalidateIssueCount={() => revalidateIssueCount()}
          revalidateRequestsCount={() => revalidateRequestsCount()}
        />
      </div>

      <div className="relative mb-16 flex w-0 min-w-0 flex-1 flex-col lg:ml-64">
        <PullToRefresh />
        <div
          className={`searchbar fixed left-0 right-0 top-0 z-10 flex flex-shrink-0 bg-opacity-80 transition duration-300 ${
            isScrolled ? 'bg-gray-700' : 'bg-transparent'
          } lg:left-64`}
          style={{
            backdropFilter: isScrolled ? 'blur(5px)' : undefined,
            WebkitBackdropFilter: isScrolled ? 'blur(5px)' : undefined,
          }}
        >
          <div className="flex flex-1 items-center justify-between px-4 md:pr-4 md:pl-4">
            <button
              className={`mr-2 hidden text-white sm:block ${
                isScrolled ? 'opacity-90' : 'opacity-70'
              } transition duration-300 focus:outline-none lg:hidden`}
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              data-testid="sidebar-toggle"
            >
              <Bars3BottomLeftIcon className="h-7 w-7" />
            </button>
            <button
              className={`mr-2 text-white ${
                isScrolled ? 'opacity-90' : 'opacity-70'
              } pwa-only transition duration-300 hover:text-white focus:text-white focus:outline-none`}
              onClick={() => router.back()}
            >
              <ArrowLeftIcon className="w-7" />
            </button>
            <SearchInput />
            <div className="flex items-center">
              <UserDropdown />
            </div>
          </div>
        </div>

        <main className="relative top-16 z-0 focus:outline-none" tabIndex={0}>
          <div className="mb-6">
            <div className="max-w-8xl mx-auto px-4">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
