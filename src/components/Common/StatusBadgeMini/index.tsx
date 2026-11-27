import Spinner from '@app/assets/spinner.svg';
import { CheckCircleIcon } from '@heroicons/react/20/solid';
import {
  BellIcon,
  ClockIcon,
  EyeSlashIcon,
  MinusSmallIcon,
  TrashIcon,
} from '@heroicons/react/24/solid';
import { MediaStatus } from '@server/constants/media';

interface StatusBadgeMiniProps {
  status: MediaStatus;
  is4k?: boolean;
  inProgress?: boolean;
  // Should the badge shrink on mobile to a smaller size? (TitleCard)
  shrink?: boolean;
  ringStatus4k?: MediaStatus;
}

interface StatusStyle {
  badge: string;
  fill: string;
  ring?: string;
}

export const statusStyle: Record<MediaStatus, StatusStyle> = {
  [MediaStatus.UNKNOWN]: {
    badge: 'bg-gray-900/80 border-gray-300 ring-gray-300 text-white',
    fill: 'bg-gray-600',
  },
  [MediaStatus.PENDING]: {
    badge: 'bg-yellow-500/80 border-yellow-400 ring-yellow-400 text-yellow-100',
    fill: 'bg-yellow-500',
    ring: 'ring-yellow-500',
  },
  [MediaStatus.PROCESSING]: {
    badge: 'bg-indigo-500/80 border-indigo-400 ring-indigo-400 text-indigo-100',
    fill: 'bg-indigo-500',
    ring: 'ring-indigo-500',
  },
  [MediaStatus.PARTIALLY_AVAILABLE]: {
    badge: 'bg-green-500/80 border-green-400 ring-green-400 text-green-100',
    fill: 'bg-[conic-gradient(theme(colors.green.500)_0_50%,theme(colors.gray.700)_0)]',
  },
  [MediaStatus.AVAILABLE]: {
    badge: 'bg-green-500/80 border-green-400 ring-green-400 text-green-100',
    fill: 'bg-green-500',
    ring: 'ring-green-500',
  },
  [MediaStatus.BLOCKLISTED]: {
    badge: 'bg-red-500/80 border-white ring-white text-white',
    fill: 'bg-red-500',
    ring: 'ring-red-500',
  },
  [MediaStatus.DELETED]: {
    badge: 'bg-red-500/80 border-red-400 ring-red-400 text-red-100',
    fill: 'bg-red-500',
    ring: 'ring-red-500',
  },
};

const statusIcon = (status: MediaStatus): React.ReactNode => {
  switch (status) {
    case MediaStatus.PROCESSING:
      return <ClockIcon />;
    case MediaStatus.AVAILABLE:
      return <CheckCircleIcon />;
    case MediaStatus.PENDING:
      return <BellIcon />;
    case MediaStatus.BLOCKLISTED:
      return <EyeSlashIcon />;
    case MediaStatus.PARTIALLY_AVAILABLE:
      return <MinusSmallIcon />;
    case MediaStatus.DELETED:
      return <TrashIcon />;
    default:
      return null;
  }
};

const StatusBadgeMini = ({
  status,
  is4k = false,
  inProgress = false,
  shrink = false,
  ringStatus4k,
}: StatusBadgeMiniProps) => {
  const style4k =
    ringStatus4k && ringStatus4k !== MediaStatus.UNKNOWN
      ? statusStyle[ringStatus4k]
      : undefined;
  const size = shrink ? 'w-4 sm:w-5' : 'w-5';
  const hasHdState = status !== MediaStatus.UNKNOWN;

  const badgeStyle = [
    `aspect-square rounded-full ${style4k ? '' : 'shadow-md'} ${size} ${
      shrink ? `border ${hasHdState ? 'p-0' : 'p-0.5'}` : 'ring-1 p-0.5'
    }`,
    statusStyle[status].badge,
  ];

  let indicatorIcon = statusIcon(
    hasHdState ? status : (ringStatus4k as MediaStatus)
  );

  if (inProgress) {
    indicatorIcon = <Spinner />;
  }

  let badge = <div className={badgeStyle.join(' ')}>{indicatorIcon}</div>;

  if (style4k) {
    badge = style4k.ring ? (
      <div
        className={`inline-flex rounded-full shadow-md ring-2 ring-offset-2 ring-offset-gray-900 ${style4k.ring}`}
      >
        {badge}
      </div>
    ) : (
      <div className="relative inline-flex">
        <span
          className={`absolute rounded-full shadow-md ${style4k.fill}`}
          style={{ inset: '-4px' }}
        />
        <span
          className="absolute rounded-full bg-gray-900"
          style={{ inset: '-2px' }}
        />
        <span className="relative inline-flex">{badge}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex whitespace-nowrap rounded-full border-gray-700 text-xs font-semibold leading-5 ring-gray-700 ${
        shrink ? '' : 'ring-1'
      }`}
    >
      {badge}
      {is4k && <span className="pl-1 pr-2 text-gray-200">4K</span>}
    </div>
  );
};

export default StatusBadgeMini;
