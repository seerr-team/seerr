import Badge from '@app/components/Common/Badge';
import CachedImage from '@app/components/Common/CachedImage';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { MediaRequestStatus } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import Link from 'next/link';
import { useMemo } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.MediaRequestSummary', {
  requester: 'Requested By',
  requestDate: 'Request Date',
  status: 'Status',
});

interface MediaRequestSummaryProps {
  requests?: MediaRequest[];
  currentUserId?: number;
}

const MediaRequestSummary = ({
  requests,
  currentUserId,
}: MediaRequestSummaryProps) => {
  const intl = useIntl();

  const sortedRequests = useMemo(
    () =>
      [...(requests ?? [])].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [requests]
  );

  if (sortedRequests.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 w-full space-y-3">
      {sortedRequests.map((request) => {
        const statusMessage = (() => {
          switch (request.status) {
            case MediaRequestStatus.APPROVED:
              return intl.formatMessage(globalMessages.approved);
            case MediaRequestStatus.DECLINED:
              return intl.formatMessage(globalMessages.declined);
            case MediaRequestStatus.FAILED:
              return intl.formatMessage(globalMessages.failed);
            case MediaRequestStatus.COMPLETED:
              return intl.formatMessage(globalMessages.completed);
            default:
              return intl.formatMessage(globalMessages.pending);
          }
        })();

        const statusBadgeType = (() => {
          switch (request.status) {
            case MediaRequestStatus.APPROVED:
            case MediaRequestStatus.COMPLETED:
              return 'success';
            case MediaRequestStatus.DECLINED:
            case MediaRequestStatus.FAILED:
              return 'danger';
            default:
              return 'warning';
          }
        })();

        return (
          <div key={request.id} className="media-facts w-full">
            <div className="media-fact">
              <span>{intl.formatMessage(messages.requester)}</span>
              <span className="media-fact-value">
                {request.requestedBy && (
                  <Link
                    href={
                      request.requestedBy.id === currentUserId
                        ? '/profile'
                        : `/users/${request.requestedBy.id}`
                    }
                    className="inline-flex items-center justify-end"
                  >
                    <span className="avatar-sm">
                      <CachedImage
                        type="avatar"
                        src={request.requestedBy.avatar}
                        alt=""
                        className="avatar-sm object-cover"
                        width={20}
                        height={20}
                      />
                    </span>
                    <span>{request.requestedBy.displayName}</span>
                  </Link>
                )}
              </span>
            </div>
            <div className="media-fact">
              <span>{intl.formatMessage(messages.requestDate)}</span>
              <span className="media-fact-value">
                {intl.formatDate(request.createdAt, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
            <div className="media-fact">
              <span>{intl.formatMessage(messages.status)}</span>
              <span className="media-fact-value flex items-center justify-end gap-2">
                {request.is4k && <Badge badgeType="warning">4K</Badge>}
                <Badge badgeType={statusBadgeType}>{statusMessage}</Badge>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MediaRequestSummary;
