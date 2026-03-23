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
    { revalidateOnMount: true }
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
      setIsScrolled(window.pageYOffset > 20);
    };

    window.addEventListener('scroll', updateScrolled, { passive: true });
    return () => window.removeEventListener('scroll', updateScrolled);
  }, []);

  return (
    <div className="relative flex h-full min-h-full min-w-0 overflow-hidden bg-[#0d1326] text-slate-100">
      {/* PWA top line */}
      <div className="pwa-only fixed inset-0 z-20 h-1 w-full border-[#2a3762] md:border-t" />

      {/* Family Glow background layers */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(51,209,255,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(167,139,250,0.12),transparent_36%),radial-gradient(circle_at_bottom,rgba(255,122,162,0.10),transparent_42%)]" />
      <div className="pointer-events-none absolute top-0 z-0 h-72 w-full bg-gradient-to-b from-[#1f2b4f]/70 via-[#17203b]/30 to-transparent" />

      <Sidebar
        open={isSidebarOpen}
        setClosed={() => setSidebarOpen(false)}
        pendingRequestsCount={requestResponse?.pending ?? 0}
        revalidateRequestsCount={() => revalidateRequestsCount()}
      />

      <div className="sm:hidden">
        <MobileMenu
          pendingRequestsCount={requestResponse?.pending ?? 0}
          revalidateRequestsCount={() => revalidateRequestsCount()}
        />
      </div>

      <div className="relative mb-16 flex w-0 min-w-0 flex-1 flex-col lg:ml-64">
        <PullToRefresh />

        <div
          className={`searchbar fixed left-0 right-0 top-0 z-10 flex flex-shrink-0 border-b transition duration-300 ${
            isScrolled
              ? 'border-[#2a3762]/80 bg-[#17203b]/70'
              : 'border-transparent bg-transparent'
          } lg:left-64`}
          style={{
            backdropFilter: isScrolled ? 'blur(10px)' : undefined,
            WebkitBackdropFilter: isScrolled ? 'blur(10px)' : undefined,
          }}
        >
          <div className="flex flex-1 items-center justify-between px-4 md:pl-4 md:pr-4">
            <button
              className={`mr-2 hidden text-slate-100 sm:block ${
                isScrolled ? 'opacity-95' : 'opacity-75'
              } transition duration-300 hover:text-cyan-300 focus:outline-none lg:hidden`}
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              data-testid="sidebar-toggle"
            >
              <Bars3BottomLeftIcon className="h-7 w-7" />
            </button>

            <button
              className={`mr-2 text-slate-100 ${
                isScrolled ? 'opacity-95' : 'opacity-75'
              } pwa-only transition duration-300 hover:text-cyan-300 focus:text-cyan-300 focus:outline-none`}
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
