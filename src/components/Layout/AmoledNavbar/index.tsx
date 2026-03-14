import CachedImage from '@app/components/Common/CachedImage';
import useSearchInput from '@app/hooks/useSearchInput';
import { Permission, useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import {
  ArrowRightOnRectangleIcon,
  ClockIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  CogIcon,
  MagnifyingGlassIcon,
  UserIcon,
} from '@heroicons/react/24/solid';
import axios from 'axios';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Layout.AmoledNavbar', {
  searchPlaceholder: 'Search Movies & TV',
  myprofile: 'Profile',
  settings: 'Settings',
  requests: 'Requests',
  signout: 'Sign Out',
});

const AmoledNavbar = () => {
  const intl = useIntl();
  const { user, revalidate, hasPermission } = useUser();
  const { searchValue, setSearchValue, setIsOpen, clear } = useSearchInput();
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const expanded = isDesktop || searchExpanded;

  // Track desktop breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Auto-focus search input when expanded
  useEffect(() => {
    if (searchExpanded && !isDesktop) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (!searchExpanded && !isDesktop) {
      clear();
      setIsOpen(false);
    }
  }, [searchExpanded, isDesktop]);

  // Close profile menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const logout = async () => {
    try {
      const response = await axios.post('/api/v1/auth/logout');
      if (response.data?.status === 'ok') revalidate();
    } catch {
      // logout failure is non-critical; ignore silently
    }
  };

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-20 flex items-start justify-between px-4 pt-4 lg:left-64">
      {/* Search pill */}
      <div className="pointer-events-auto flex items-center">
        <div
          className="flex items-center overflow-hidden rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{
            width: expanded ? '280px' : '44px',
            height: '44px',
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: expanded
              ? '0 0 0 1px rgba(255,255,255,0.18), 0 8px 32px rgba(0,0,0,0.4)'
              : '0 0 0 1px rgba(255,255,255,0.18)',
          }}
        >
          <button
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center text-white/80 transition hover:text-white ${isDesktop ? 'pointer-events-none' : ''}`}
            onClick={() => !isDesktop && setSearchExpanded((v) => !v)}
          >
            <style>{`
              @keyframes iconPop {
                from { opacity: 0; transform: scale(0.6) rotate(-15deg); }
                to   { opacity: 1; transform: scale(1) rotate(0deg); }
              }
              .icon-pop {
                animation: iconPop 250ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
              }
            `}</style>
            {searchExpanded && !isDesktop ? (
              <XMarkIcon key="x" className="h-5 w-5 icon-pop" />
            ) : (
              <MagnifyingGlassIcon key="search" className="h-5 w-5 icon-pop" />
            )}
          </button>

          <input
            ref={searchInputRef}
            type="search"
            autoComplete="off"
            value={searchValue}
            placeholder={intl.formatMessage(messages.searchPlaceholder)}
            className="h-full flex-1 bg-transparent pr-4 text-sm text-white placeholder-white/40 outline-none ring-0 border-none focus:ring-0 focus:border-none focus:outline-none"
            style={{
              opacity: expanded ? 1 : 0,
              pointerEvents: expanded ? 'auto' : 'none',
              transition: 'opacity 200ms ease',
            }}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              if (!searchValue) setIsOpen(false);
            }}
            onKeyUp={(e) => {
              if (e.key === 'Escape') setSearchExpanded(false);
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
      </div>

      {/* Profile circle */}
      <div className="pointer-events-auto relative" ref={profileRef}>
        <button
          onClick={() => setProfileOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full transition-all duration-300"
          style={{
            boxShadow: profileOpen
              ? '0 0 0 2px rgba(139,92,246,0.7)'
              : '0 0 0 1px rgba(255,255,255,0.12)',
          }}
        >
          <CachedImage
            type="avatar"
            className="h-11 w-11 rounded-full object-cover"
            src={user ? user.avatar : ''}
            alt=""
            width={44}
            height={44}
          />
        </button>

        {/* Dropdown */}
        <div
          className="absolute right-0 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl transition-all duration-300"
          style={{
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 0 0 1px rgba(139,92,246,0.2), 0 16px 48px rgba(0,0,0,0.6)',
            opacity: profileOpen ? 1 : 0,
            transform: profileOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-8px)',
            pointerEvents: profileOpen ? 'auto' : 'none',
          }}
        >
          {/* User info */}
          <div className="flex items-center gap-3 px-4 py-4">
            <CachedImage
              type="avatar"
              className="h-9 w-9 rounded-full object-cover ring-1 ring-purple-500/40"
              src={user ? user.avatar : ''}
              alt=""
              width={36}
              height={36}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {user?.displayName}
              </p>
              {user?.displayName?.toLowerCase() !== user?.email?.toLowerCase() && (
                <p className="truncate text-xs text-white/50">{user?.email}</p>
              )}
            </div>
          </div>

          <div className="border-t border-white/[0.06] p-1.5">
            {[
              { href: '/profile', icon: UserIcon, label: intl.formatMessage(messages.myprofile) },
              {
                href: hasPermission(
                  [Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW],
                  { type: 'or' }
                )
                  ? `/users/${user?.id}/requests?filter=all`
                  : '/requests',
                icon: ClockIcon,
                label: intl.formatMessage(messages.requests),
              },
              { href: '/profile/settings', icon: CogIcon, label: intl.formatMessage(messages.settings) },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/[0.07] hover:text-white"
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </Link>
            ))}

            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-red-500/10 hover:text-red-400"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4 flex-shrink-0" />
              {intl.formatMessage(messages.signout)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AmoledNavbar;
