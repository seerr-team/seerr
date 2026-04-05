import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import Tooltip from '@app/components/Common/Tooltip';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { CheckIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { MediaRemovalRequestStatus } from '@server/constants/media';
import type { MediaRemovalRequest } from '@server/entity/MediaRemovalRequest';
import axios from 'axios';
import Link from 'next/link';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.RemovalRequestBlock', {
  approve: 'Approve Removal',
  decline: 'Decline Removal',
  delete: 'Delete Request',
  pending: 'Pending',
  approved: 'Approved',
  declined: 'Declined',
  failed: 'Failed',
  removal: 'Removal',
  removal4k: '4K Removal',
  seasons: '{count, plural, one {Season {seasons}} other {{count} Seasons}}',
});

interface RemovalRequestBlockProps {
  request: MediaRemovalRequest;
  onUpdate?: () => void;
}

const RemovalRequestBlock = ({
  request,
  onUpdate,
}: RemovalRequestBlockProps) => {
  const { hasPermission } = useUser();
  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(false);

  const updateRequest = async (
    action: 'approve' | 'decline' | 'retry'
  ): Promise<void> => {
    setIsLoading(true);
    try {
      await axios.post(`/api/v1/removal-request/${request.id}/${action}`);
      onUpdate?.();
    } catch {
      // Revalidate to sync UI state even on error
      onUpdate?.();
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRequest = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await axios.delete(`/api/v1/removal-request/${request.id}`);
      onUpdate?.();
    } catch {
      onUpdate?.();
    } finally {
      setIsLoading(false);
    }
  };

  const statusBadge = (() => {
    switch (request.status) {
      case MediaRemovalRequestStatus.PENDING:
        return (
          <Badge badgeType="warning">
            {intl.formatMessage(messages.pending)}
          </Badge>
        );
      case MediaRemovalRequestStatus.APPROVED:
        return (
          <Badge badgeType="success">
            {intl.formatMessage(messages.approved)}
          </Badge>
        );
      case MediaRemovalRequestStatus.DECLINED:
        return (
          <Badge badgeType="danger">
            {intl.formatMessage(messages.declined)}
          </Badge>
        );
      case MediaRemovalRequestStatus.FAILED:
        return (
          <Badge badgeType="danger">
            {intl.formatMessage(messages.failed)}
          </Badge>
        );
    }
  })();

  return (
    <div className="flex items-center justify-between px-4 py-3 text-gray-400">
      <div className="flex min-w-0 items-center space-x-2">
        {statusBadge}
        {request.seasons && request.seasons.length > 0 && (
          <Tooltip content={request.seasons.map((s) => `S${s}`).join(', ')}>
            <Badge badgeType="default" className="shrink-0">
              {intl.formatMessage(messages.seasons, {
                count: request.seasons.length,
                seasons: request.seasons.join(', '),
              })}
            </Badge>
          </Tooltip>
        )}
        {request.requestedBy && (
          <Tooltip
            content={`${request.requestedBy.displayName} – ${intl.formatDate(request.createdAt, { year: 'numeric', month: 'short', day: 'numeric' })}`}
          >
            <Link
              href={`/users/${request.requestedBy.id}`}
              className="shrink-0"
            >
              <CachedImage
                type="avatar"
                src={request.requestedBy.avatar}
                alt={request.requestedBy.displayName}
                className="h-5 w-5 rounded-full object-cover"
                width={20}
                height={20}
              />
            </Link>
          </Tooltip>
        )}
      </div>
      <div className="flex shrink-0 items-center space-x-1">
        {hasPermission(Permission.MANAGE_REQUESTS) &&
          request.status === MediaRemovalRequestStatus.PENDING && (
            <>
              <Tooltip content={intl.formatMessage(messages.approve)}>
                <Button
                  buttonType="success"
                  buttonSize="sm"
                  disabled={isLoading}
                  onClick={() => updateRequest('approve')}
                >
                  <CheckIcon className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip content={intl.formatMessage(messages.decline)}>
                <Button
                  buttonType="danger"
                  buttonSize="sm"
                  disabled={isLoading}
                  onClick={() => updateRequest('decline')}
                >
                  <XMarkIcon className="h-4 w-4" />
                </Button>
              </Tooltip>
            </>
          )}
        {hasPermission(Permission.MANAGE_REQUESTS) &&
          request.status === MediaRemovalRequestStatus.FAILED && (
            <Tooltip content={intl.formatMessage(globalMessages.retry)}>
              <Button
                buttonType="primary"
                buttonSize="sm"
                disabled={isLoading}
                onClick={() => updateRequest('retry')}
              >
                {intl.formatMessage(globalMessages.retry)}
              </Button>
            </Tooltip>
          )}
        <Tooltip content={intl.formatMessage(messages.delete)}>
          <Button
            buttonType="danger"
            buttonSize="sm"
            disabled={isLoading}
            onClick={() => deleteRequest()}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};

export default RemovalRequestBlock;
