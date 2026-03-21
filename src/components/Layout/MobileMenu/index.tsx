import Badge from '@app/components/Common/Badge';
import { menuMessages } from '@app/components/Layout/Sidebar';
import useClickOutside from '@app/hooks/useClickOutside';
import { Permission, useUser } from '@app/hooks/useUser';
import { Transition } from '@headlessui/react';
import {
  ClockIcon,
  CogIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  EyeSlashIcon,
  FilmIcon,
  SparklesIcon,
  TvIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import {
  ClockIcon as FilledClockIcon,
  CogIcon as FilledCogIcon,
  ExclamationTriangleIcon as FilledExclamationTriangleIcon,
  EyeSlashIcon as FilledEyeSlashIcon,
  FilmIcon as FilledFilmIcon,
  SparklesIcon as FilledSparklesIcon,
  TvIcon as FilledTvIcon,
  UsersIcon as FilledUsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { cloneElement, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';

interface MobileMenuProps {
  pendingRequestsCount: number;
  openIssuesCount: number;
  revalidateIssueCount: () => void;
  revalidateRequestsCount: () => void;
}

interface MenuLink {
  href: string;
  svgIcon: JSX.Element;
  svgIconSelected: JSX.Element;
  content: React.ReactNode;
  activeRegExp: RegExp;
  as?: string;
  requiredPermission?: Permission | Permission[];
  permissionType?: 'and' | 'or';
  dataTestId?: string;
}

const MobileMenu = ({
  pendingRequestsCount,
  openIssuesCount,
  revalidateIssueCount,
  revalidateRequestsCount,
}: MobileMenuProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);
  const { hasPermission } = useUser();
  const router = useRouter();

  useClickOutside(ref, () => {
    setTimeout(() => {
      if (isOpen) setIsOpen(false);
    }, 150);
  });

  const toggle = () => setIsOpen(!isOpen);

  const menuLinks: MenuLink[] = [
    {
      href: '/',
      content: intl.formatMessage(menuMessages.dashboard),
      svgIcon: <SparklesIcon className="h-6 w-6" />,
      svgIconSelected: <FilledSparklesIcon className="h-6 w-6" />,
      activeRegExp: /^\/(discover\/?)?$/,
    },
    {
      href: '/discover/movies',
      content: intl.formatMessage(menuMessages.browsemovies),
      svgIcon: <FilmIcon className="h-6 w-6" />,
      svgIconSelected: <FilledFilmIcon className="h-6 w-6" />,
      activeRegExp: /^\/discover\/movies$/,
    },
    {
      href: '/discover/tv',
      content: intl.formatMessage(menuMessages.browsetv),
      svgIcon: <TvIcon className="h-6 w-6" />,
      svgIconSelected: <FilledTvIcon className="h-6 w-6" />,
      activeRegExp: /^\/discover\/tv$/,
    },
    {
      href: '/requests',
      content: intl.formatMessage(menuMessages.requests),
      svgIcon: <ClockIcon className="h-6 w-6" />,
      svgIconSelected: <FilledClockIcon className="h-6 w-6" />,
      activeRegExp: /^\/requests/,
    },
    {
      href: '/blocklist',
      content: intl.formatMessage(menuMessages.blocklist),
      svgIcon: <EyeSlashIcon className="h-6 w-6" />,
      svgIconSelected: <FilledEyeSlashIcon className="h-6 w-6" />,
      activeRegExp: /^\/blocklist/,
      requiredPermission: [
        Permission.MANAGE_BLOCKLIST,
        Permission.VIEW_BLOCKLIST,
      ],
      permissionType: 'or',
    },
    {
      href: '/issues',
      content: intl.formatMessage(menuMessages.issues),
      svgIcon: <ExclamationTriangleIcon className="h-6 w-6" />,
      svgIconSelected: <FilledExclamationTriangleIcon className="h-6 w-6" />,
      activeRegExp: /^\/issues/,
      requiredPermission: [
        Permission.MANAGE_ISSUES,
        Permission.CREATE_ISSUES,
        Permission.VIEW_ISSUES,
      ],
      permissionType: 'or',
    },
    {
      href: '/users',
      content: intl.formatMessage(menuMessages.users),
      svgIcon: <UsersIcon className="h-6 w-6" />,
      svgIconSelected: <FilledUsersIcon className="h-6 w-6" />,
      activeRegExp: /^\/users/,
      requiredPermission: Permission.MANAGE_USERS,
      dataTestId: 'sidebar-menu-users',
    },
    {
      href: '/settings',
      content: intl.formatMessage(menuMessages.settings),
      svgIcon: <CogIcon className="h-6 w-6" />,
      svgIconSelected: <FilledCogIcon className="h-6 w-6" />,
      activeRegExp: /^\/settings/,
      requiredPermission: Permission.ADMIN,
      dataTestId: 'sidebar-menu-settings',
    },
  ];

  const filteredLinks = menuLinks.filter(
    (link) =>
      !link.requiredPermission ||
      hasPermission(link.requiredPermission, {
        type: link.permissionType ?? 'and',
      })
  );

  useEffect(() => {
    if (openIssuesCount) revalidateIssueCount();
    if (pendingRequestsCount) revalidateRequestsCount();
  }, [
    revalidateIssueCount,
    revalidateRequestsCount,
    pendingRequestsCount,
    openIssuesCount,
  ]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <Transition
        show={isOpen}
        as="div"
        ref={ref}
        enter="transition duration-400"
        enterFrom="opacity-0 translate-y-0"
        enterTo="opacity-100 -translate-y-full"
        leave="transition duration-300"
        leaveFrom="opacity-100 -translate-y-full"
        leaveTo="opacity-0 translate-y-0"
        className="bg-[#17203b]/92 absolute left-0 right-0 top-0 flex w-full -translate-y-full flex-col space-y-5 border-t border-[#2a3762] px-6 py-6 font-semibold text-slate-100 backdrop-blur-md"
      >
        {filteredLinks.map((link) => {
          const isActive = router.pathname.match(link.activeRegExp);
          return (
            <Link
              key={`mobile-menu-link-${link.href}`}
              href={link.href}
              className={`flex items-center rounded-lg px-2 py-2 transition ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-400/20 via-violet-400/20 to-pink-400/20 text-cyan-200 ring-1 ring-cyan-300/30'
                  : 'text-slate-100 hover:bg-[#2a3762]/70'
              }`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsOpen(false);
              }}
              onClick={() => setIsOpen(false)}
              role="button"
              tabIndex={0}
            >
              {cloneElement(isActive ? link.svgIconSelected : link.svgIcon, {
                className: 'h-5 w-5',
              })}
              <span className="ml-2">{link.content}</span>

              {link.href === '/requests' &&
                pendingRequestsCount > 0 &&
                hasPermission(Permission.MANAGE_REQUESTS) && (
                  <div className="ml-auto flex">
                    <Badge className="rounded-md border border-cyan-300/30 bg-gradient-to-r from-cyan-400/20 to-violet-400/20 text-cyan-100">
                      {pendingRequestsCount}
                    </Badge>
                  </div>
                )}

              {link.href === '/issues' &&
                openIssuesCount > 0 &&
                hasPermission(Permission.MANAGE_ISSUES) && (
                  <div className="ml-auto flex">
                    <Badge className="rounded-md border border-cyan-300/30 bg-gradient-to-r from-cyan-400/20 to-violet-400/20 text-cyan-100">
                      {openIssuesCount}
                    </Badge>
                  </div>
                )}
            </Link>
          );
        })}
      </Transition>

      <div className="padding-bottom-safe border-t border-[#2a3762] bg-[#17203b]/90 backdrop-blur-md">
        <div className="flex h-full items-center justify-between px-6 py-4 text-slate-100">
          {filteredLinks
            .slice(0, filteredLinks.length === 5 ? 5 : 4)
            .map((link) => {
              const isActive =
                router.pathname.match(link.activeRegExp) && !isOpen;

              return (
                <Link
                  key={`mobile-menu-link-${link.href}`}
                  href={link.href}
                  className={`relative flex flex-col items-center space-y-1 transition ${
                    isActive ? 'text-cyan-300' : 'text-slate-200'
                  }`}
                >
                  {cloneElement(
                    isActive ? link.svgIconSelected : link.svgIcon,
                    { className: 'h-6 w-6' }
                  )}

                  {link.href === '/requests' &&
                    pendingRequestsCount > 0 &&
                    hasPermission(Permission.MANAGE_REQUESTS) && (
                      <div className="absolute bottom-3 left-3">
                        <Badge
                          className={`flex h-4 items-center justify-center rounded-md border text-[8px] ${
                            router.pathname.match(link.activeRegExp)
                              ? 'border-cyan-300/40 bg-gradient-to-r from-cyan-400/30 to-violet-400/30 text-cyan-100'
                              : 'border-cyan-300/30 bg-gradient-to-r from-cyan-400/20 to-violet-400/20 text-cyan-100'
                          } ${pendingRequestsCount > 99 ? 'w-6' : 'w-4'} !px-[5px] !py-[7px]`}
                        >
                          {pendingRequestsCount > 99
                            ? '99+'
                            : pendingRequestsCount}
                        </Badge>
                      </div>
                    )}
                </Link>
              );
            })}

          {filteredLinks.length > 4 && filteredLinks.length !== 5 && (
            <button
              className={`flex flex-col items-center space-y-1 transition ${
                isOpen ? 'text-cyan-300' : 'text-slate-200'
              }`}
              onClick={() => toggle()}
            >
              {isOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <EllipsisHorizontalIcon className="h-6 w-6" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileMenu;
