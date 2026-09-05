import { statusStyle } from '@app/components/Common/StatusBadgeMini';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { MediaStatus } from '@server/constants/media';
import { useIntl } from 'react-intl';

interface AvailabilityPopoverProps {
  status?: MediaStatus;
  status4k?: MediaStatus;
  show4k?: boolean;
  inProgress?: boolean;
  inProgress4k?: boolean;
}

const messages = defineMessages('components.TitleCard', {
  status4k: '4K {status}',
});

const statusMessage = {
  [MediaStatus.AVAILABLE]: globalMessages.available,
  [MediaStatus.PARTIALLY_AVAILABLE]: globalMessages.partiallyavailable,
  [MediaStatus.PROCESSING]: globalMessages.requested,
  [MediaStatus.PENDING]: globalMessages.pending,
  [MediaStatus.BLOCKLISTED]: globalMessages.blocklisted,
  [MediaStatus.DELETED]: globalMessages.deleted,
  [MediaStatus.UNKNOWN]: globalMessages.notrequested,
};

const AvailabilityPopover = ({
  status,
  status4k,
  show4k = false,
  inProgress = false,
  inProgress4k = false,
}: AvailabilityPopoverProps) => {
  const intl = useIntl();

  const row = (is4k: boolean, rowStatus: MediaStatus, downloading: boolean) => {
    const label = intl.formatMessage(
      downloading && rowStatus === MediaStatus.PROCESSING
        ? globalMessages.processing
        : statusMessage[rowStatus]
    );

    return (
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 flex-none rounded-full ${statusStyle[rowStatus].fill}`}
        />
        <span className="font-semibold">
          {is4k
            ? intl.formatMessage(messages.status4k, { status: label })
            : label}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {row(false, status ?? MediaStatus.UNKNOWN, inProgress)}
      {show4k && row(true, status4k ?? MediaStatus.UNKNOWN, inProgress4k)}
    </div>
  );
};

export default AvailabilityPopover;
