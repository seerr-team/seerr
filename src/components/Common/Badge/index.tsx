import Link from 'next/link';
import React from 'react';

interface BadgeProps {
  badgeType?:
    | 'default'
    | 'primary'
    | 'danger'
    | 'warning'
    | 'success'
    | 'dark'
    | 'light';
  className?: string;
  href?: string;
  children: React.ReactNode;
}

const Badge = (
  { badgeType = 'default', className, href, children }: BadgeProps,
  ref?: React.Ref<HTMLElement>
) => {
  const badgeStyle = [
    'inline-flex whitespace-nowrap rounded-full border px-2 text-xs font-semibold leading-5',
    'ring-1 ring-white/5',
  ];

  if (href) {
    badgeStyle.push('cursor-pointer transition !no-underline');
  } else {
    badgeStyle.push('cursor-default');
  }

  switch (badgeType) {
    case 'danger':
      badgeStyle.push(
        'border-red-400/40 bg-red-500/20 !text-red-100 shadow-[0_0_0_1px_rgba(248,113,113,0.15)]'
      );
      if (href) badgeStyle.push('hover:bg-red-500/30');
      break;

    case 'warning':
      badgeStyle.push(
        'border-amber-300/40 bg-amber-500/20 !text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.15)]'
      );
      if (href) badgeStyle.push('hover:bg-amber-500/30');
      break;

    case 'success':
      badgeStyle.push(
        'border-emerald-300/40 bg-emerald-500/20 !text-emerald-100 shadow-[0_0_0_1px_rgba(52,211,153,0.15)]'
      );
      if (href) badgeStyle.push('hover:bg-emerald-500/30');
      break;

    case 'dark':
      badgeStyle.push(
        'border-[#2a3762] bg-[#0f1630] !text-slate-300 shadow-[0_0_0_1px_rgba(42,55,98,0.2)]'
      );
      if (href) badgeStyle.push('hover:bg-[#17203b]');
      break;

    case 'light':
      badgeStyle.push(
        'border-[#3d4f82] bg-[#1f2b4f] !text-slate-200 shadow-[0_0_0_1px_rgba(61,79,130,0.2)]'
      );
      if (href) badgeStyle.push('hover:bg-[#2a3762]');
      break;

    case 'primary':
    case 'default':
    default:
      badgeStyle.push(
        'border-cyan-300/35 bg-gradient-to-r from-cyan-400/25 to-violet-400/25 !text-cyan-100 shadow-[0_0_0_1px_rgba(51,209,255,0.18)]'
      );
      if (href)
        badgeStyle.push('hover:from-cyan-400/35 hover:to-violet-400/35');
      break;
  }

  if (className) {
    badgeStyle.push(className);
  }

  if (href?.includes('://')) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={badgeStyle.join(' ')}
        ref={ref as React.Ref<HTMLAnchorElement>}
      >
        {children}
      </a>
    );
  } else if (href) {
    return (
      <Link
        href={href}
        className={badgeStyle.join(' ')}
        ref={ref as React.Ref<HTMLAnchorElement>}
      >
        {children}
      </Link>
    );
  } else {
    return (
      <span
        className={badgeStyle.join(' ')}
        ref={ref as React.Ref<HTMLSpanElement>}
      >
        {children}
      </span>
    );
  }
};

export default React.forwardRef(Badge) as typeof Badge;
