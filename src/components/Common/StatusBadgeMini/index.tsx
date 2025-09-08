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
}

const StatusBadgeMini = ({
  status,
  is4k = false,
  inProgress = false,
  shrink = false,
}: StatusBadgeMiniProps) => {
  const badgeStyle = [
    `rounded-full bg-opacity-80 shadow-md ${
      shrink ? 'w-4 sm:w-5 border p-0' : 'w-5 ring-1 p-0.5'
    }`,
  ];

  let indicatorIcon: React.ReactNode;

  switch (status) {
    case MediaStatus.PROCESSING:
      badgeStyle.push(
        'bg-indigo-500 border-indigo-400 ring-indigo-400 text-indigo-100'
      );
      indicatorIcon = <ClockIcon />;
      break;
    case MediaStatus.AVAILABLE:
      badgeStyle.push(
        'bg-green-500 border-green-400 ring-green-400 text-green-100'
      );
      indicatorIcon = <CheckCircleIcon />;
      break;
    case MediaStatus.PENDING:
      badgeStyle.push(
        'bg-yellow-500 border-yellow-400 ring-yellow-400 text-yellow-100'
      );
      indicatorIcon = <BellIcon />;
      break;
    case MediaStatus.BLACKLISTED:
      badgeStyle.push('bg-red-500 border-white-400 ring-white-400 text-white');
      indicatorIcon = <EyeSlashIcon />;
      break;
    case MediaStatus.PARTIALLY_AVAILABLE:
      badgeStyle.push(
        'bg-green-500 border-green-400 ring-green-400 text-green-100'
      );
      indicatorIcon = <MinusSmallIcon />;
      break;
    case MediaStatus.DELETED:
      badgeStyle.push('bg-red-500 border-red-400 ring-red-400 text-red-100');
      indicatorIcon = <TrashIcon />;
      break;
  }

  if (inProgress) {
    indicatorIcon = <Spinner />;
  }

  return (
    <div
      className={`relative inline-flex whitespace-nowrap rounded-full border-gray-700 text-xs font-semibold leading-5 ring-gray-700 ${
        shrink ? '' : 'ring-1'
      }`}
    >
      <div className={badgeStyle.join(' ')}>{indicatorIcon}</div>
      {is4k && <span className="pl-1 pr-2 text-gray-200">4K</span>}
    </div>
  );
};

export default StatusBadgeMini;
