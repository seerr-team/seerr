import BlacklistedTagsBadge from '@app/components/BlacklistedTagsBadge';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Tooltip from '@app/components/Common/Tooltip';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { CalendarIcon, TrashIcon, UserIcon } from '@heroicons/react/24/solid';
import type { Blacklist } from '@server/entity/Blacklist';
import axios from 'axios';
import Link from 'next/link';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

const messages = defineMessages('component.BlacklistBlock', {
  blacklistedby: 'Blacklisted By',
  blacklistdate: 'Blacklisted date',
});

interface BlacklistBlockProps {
  tmdbId: number;
  onUpdate?: () => void;
  onDelete?: () => void;
}

const BlacklistBlock = ({
  tmdbId,
  onUpdate,
  onDelete,
}: BlacklistBlockProps) => {
  const { user } = useUser();
  const intl = useIntl();
  const [isUpdating, setIsUpdating] = useState(false);
  const { addToast } = useToasts();
  const { data } = useSWR<Blacklist>(`/api/v1/blacklist/${tmdbId}`);

  const removeFromBlacklist = async (tmdbId: number, title?: string) => {
    setIsUpdating(true);

    try {
      await axios.delete('/api/v1/blacklist/' + tmdbId);

      addToast(
        <span>
          {intl.formatMessage(globalMessages.removeFromBlacklistSuccess, {
            title,
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'success', autoDismiss: true }
      );
    } catch {
      addToast(intl.formatMessage(globalMessages.blacklistError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }

    onUpdate && onUpdate();
    onDelete && onDelete();

    setIsUpdating(false);
  };

  if (!data) {
    return (
      <>
        <LoadingSpinner />
      </>
    );
  }

  return (
    <div className="px-4 py-3 text-gray-300">
      <div className="flex items-center justify-between">
        <div className="mr-6 min-w-0 flex-1 flex-col items-center text-sm leading-5">
          <div className="white mb-1 flex flex-nowrap">
            {data.user ? (
              <>
                <Tooltip content={intl.formatMessage(messages.blacklistedby)}>
                  <UserIcon className="mr-1.5 h-5 w-5 min-w-0 flex-shrink-0" />
                </Tooltip>
                <span className="w-40 truncate md:w-auto">
                  <Link
                    href={
                      data.user.id === user?.id
                        ? '/profile'
                        : `/users/${data.user.id}`
                    }
                  >
                    <span className="font-semibold text-gray-100 transition duration-300 hover:text-white hover:underline">
                      {data.user.displayName}
                    </span>
                  </Link>
                </span>
              </>
            ) : data.blacklistedTags ? (
              <>
                <span className="w-40 truncate md:w-auto">
                  {intl.formatMessage(messages.blacklistedby)}:&nbsp;
                </span>
                <BlacklistedTagsBadge data={data} />
              </>
            ) : null}
          </div>
        </div>
        <div className="ml-2 flex flex-shrink-0 flex-wrap">
          <Tooltip
            content={intl.formatMessage(globalMessages.removefromBlacklist)}
          >
            <Button
              buttonType="danger"
              onClick={() => removeFromBlacklist(data.tmdbId, data.title)}
              disabled={isUpdating}
            >
              <TrashIcon className="icon-sm" />
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className="mt-2 sm:flex sm:justify-between">
        <div className="sm:flex">
          <div className="mr-6 flex items-center text-sm leading-5">
            <Badge badgeType="danger">
              {intl.formatMessage(globalMessages.blacklisted)}
            </Badge>
          </div>
        </div>
        <div className="mt-2 flex items-center text-sm leading-5 sm:mt-0">
          <Tooltip content={intl.formatMessage(messages.blacklistdate)}>
            <CalendarIcon className="mr-1.5 h-5 w-5 flex-shrink-0" />
          </Tooltip>
          <span>
            {intl.formatDate(data.createdAt, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BlacklistBlock;
