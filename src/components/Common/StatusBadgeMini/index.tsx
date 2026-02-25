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
    `rounded-full shadow-md ${
      shrink ? 'w-4 sm:w-5 border p-0' : 'w-5 ring-1 p-0.5'
    }`,
  ];

  let indicatorIcon: React.ReactNode;

  switch (status) {
    case MediaStatus.PROCESSING:
      badgeStyle.push(
        'bg-indigo-500/80 border-indigo-400 ring-indigo-400 text-indigo-100'
      );
      indicatorIcon = <ClockIcon />;
      break;
    case MediaStatus.AVAILABLE:
      badgeStyle.push(
        'bg-green-500/80 border-green-400 ring-green-400 text-green-100'
      );
      indicatorIcon = <CheckCircleIcon />;
      break;
    case MediaStatus.PENDING:
      badgeStyle.push(
        'bg-yellow-500/80 border-yellow-400 ring-yellow-400 text-yellow-100'
      );
      indicatorIcon = <BellIcon />;
      break;
    case MediaStatus.BLOCKLISTED:
      badgeStyle.push('bg-red-500/80 border-white ring-white text-white');
      indicatorIcon = <EyeSlashIcon />;
      break;
    case MediaStatus.PARTIALLY_AVAILABLE:
      badgeStyle.push(
        'bg-green-500/80 border-green-400 ring-green-400 text-green-100'
      );
      indicatorIcon = <MinusSmallIcon />;
      break;
    case MediaStatus.DELETED:
      badgeStyle.push('bg-red-500/80 border-red-400 ring-red-400 text-red-100');
      indicatorIcon = <TrashIcon />;
      break;
  }

  if (inProgress) {
    indicatorIcon = <Spinner />;
  }

  return (
    <div
      className={`relative inline-flex rounded-full border-gray-700 text-xs leading-5 font-semibold whitespace-nowrap ring-gray-700 ${
        shrink ? '' : 'ring-1'
      }`}
    >
      <div className={badgeStyle.join(' ')}>{indicatorIcon}</div>
      {is4k && <span className="pr-2 pl-1 text-gray-200">4K</span>}
    </div>
  );
};

export default StatusBadgeMini;
