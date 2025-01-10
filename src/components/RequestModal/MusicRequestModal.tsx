import Alert from '@app/components/Common/Alert';
import Modal from '@app/components/Common/Modal';
import type { RequestOverrides } from '@app/components/RequestModal/AdvancedRequester';
import AdvancedRequester from '@app/components/RequestModal/AdvancedRequester';
import QuotaDisplay from '@app/components/RequestModal/QuotaDisplay';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { MediaStatus } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { NonFunctionProperties } from '@server/interfaces/api/common';
import type { QuotaResponse } from '@server/interfaces/api/userInterfaces';
import { Permission } from '@server/lib/permissions';
import type { MusicDetails } from '@server/models/Music';
import { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR, { mutate } from 'swr';

const messages = defineMessages('components.RequestModal', {
  requestadmin: 'This request will be approved automatically.',
  requestSuccess: '<strong>{title}</strong> requested successfully!',
  requestCancel: 'Request for <strong>{title}</strong> canceled.',
  requestmusictitle: 'Request Music',
  edit: 'Edit Request',
  approve: 'Approve Request',
  cancel: 'Cancel Request',
  pendingrequest: 'Pending Album Request',
  requestfrom: "{username}'s request is pending approval.",
  errorediting: 'Something went wrong while editing the request.',
  requestedited: 'Request for <strong>{title}</strong> edited successfully!',
  requestApproved: 'Request for <strong>{title}</strong> approved!',
  requesterror: 'Something went wrong while submitting the request.',
  pendingapproval: 'Your request is pending approval.',
});

interface RequestModalProps extends React.HTMLAttributes<HTMLDivElement> {
  mbId?: string;
  onCancel?: () => void;
  onComplete?: (newStatus: MediaStatus) => void;
  onUpdating?: (isUpdating: boolean) => void;
  editRequest?: NonFunctionProperties<MediaRequest>;
}

const MusicRequestModal = ({
  mbId,
  onCancel,
  onComplete,
  onUpdating,
  editRequest,
}: RequestModalProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [requestOverrides, setRequestOverrides] =
    useState<RequestOverrides | null>(null);
  const { addToast } = useToasts();
  const { data, error } = useSWR<MusicDetails>(`/api/v1/music/${mbId}`, {
    revalidateOnMount: true,
  });
  const intl = useIntl();
  const { user, hasPermission } = useUser();
  const { data: quota } = useSWR<QuotaResponse>(
    user &&
      (!requestOverrides?.user?.id || hasPermission(Permission.MANAGE_USERS))
      ? `/api/v1/user/${requestOverrides?.user?.id ?? user.id}/quota`
      : null
  );

  useEffect(() => {
    if (onUpdating) {
      onUpdating(isUpdating);
    }
  }, [isUpdating, onUpdating]);

  const sendRequest = useCallback(async () => {
    setIsUpdating(true);

    try {
      let overrideParams = {};
      if (requestOverrides) {
        overrideParams = {
          serverId: requestOverrides.server,
          profileId: requestOverrides.profile,
          rootFolder: requestOverrides.folder,
          userId: requestOverrides.user?.id,
          tags: requestOverrides.tags,
        };
      }
      const res = await fetch('/api/v1/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaId: data?.mbId,
          mediaType: 'music',
          ...overrideParams,
        }),
      });
      if (!res.ok) throw new Error();
      const mediaRequest: MediaRequest = await res.json();
      mutate('/api/v1/request?filter=all&take=10&sort=modified&skip=0');

      if (mediaRequest) {
        if (onComplete) {
          onComplete(
            hasPermission(Permission.AUTO_APPROVE)
              ? MediaStatus.PROCESSING
              : MediaStatus.PENDING
          );
        }
        addToast(
          <span>
            {intl.formatMessage(messages.requestSuccess, {
              title: data?.title,
              strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
            })}
          </span>,
          { appearance: 'success', autoDismiss: true }
        );
      }
    } catch (e) {
      addToast(intl.formatMessage(messages.requesterror), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsUpdating(false);
    }
  }, [data, onComplete, addToast, requestOverrides, hasPermission, intl]);

  const cancelRequest = async () => {
    setIsUpdating(true);

    try {
      const res = await fetch(`/api/v1/request/${editRequest?.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();

      mutate('/api/v1/request?filter=all&take=10&sort=modified&skip=0');

      if (res.status === 204) {
        if (onComplete) {
          onComplete(MediaStatus.UNKNOWN);
        }
        addToast(
          <span>
            {intl.formatMessage(messages.requestCancel, {
              title: data?.title,
              strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
            })}
          </span>,
          { appearance: 'success', autoDismiss: true }
        );
      }
    } catch (e) {
      setIsUpdating(false);
    }
  };

  const updateRequest = async (alsoApproveRequest = false) => {
    setIsUpdating(true);

    try {
      const res = await fetch(`/api/v1/request/${editRequest?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaType: 'music',
          serverId: requestOverrides?.server,
          profileId: requestOverrides?.profile,
          rootFolder: requestOverrides?.folder,
          userId: requestOverrides?.user?.id,
          tags: requestOverrides?.tags,
        }),
      });
      if (!res.ok) throw new Error();

      if (alsoApproveRequest) {
        const res = await fetch(`/api/v1/request/${editRequest?.id}/approve`, {
          method: 'POST',
        });
        if (!res.ok) throw new Error();
      }
      mutate('/api/v1/request?filter=all&take=10&sort=modified&skip=0');

      addToast(
        <span>
          {intl.formatMessage(
            alsoApproveRequest
              ? messages.requestApproved
              : messages.requestedited,
            {
              title: data?.title,
              strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
            }
          )}
        </span>,
        {
          appearance: 'success',
          autoDismiss: true,
        }
      );

      if (onComplete) {
        onComplete(MediaStatus.PENDING);
      }
    } catch (e) {
      addToast(<span>{intl.formatMessage(messages.errorediting)}</span>, {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (editRequest) {
    const isOwner = editRequest.requestedBy.id === user?.id;

    return (
      <Modal
        loading={!data && !error}
        backgroundClickable
        onCancel={onCancel}
        title={intl.formatMessage(messages.pendingrequest)}
        subTitle={
          data ? `${data.artist.artistName} - ${data.title}` : undefined
        }
        backdrop={
          data?.artist?.images?.find((img) => img.CoverType === 'Fanart')?.Url
        }
        onOk={() =>
          hasPermission(Permission.MANAGE_REQUESTS)
            ? updateRequest(true)
            : hasPermission(Permission.REQUEST_ADVANCED)
            ? updateRequest()
            : cancelRequest()
        }
        okDisabled={isUpdating}
        okText={
          hasPermission(Permission.MANAGE_REQUESTS)
            ? intl.formatMessage(messages.approve)
            : hasPermission(Permission.REQUEST_ADVANCED)
            ? intl.formatMessage(messages.edit)
            : intl.formatMessage(messages.cancel)
        }
        okButtonType={
          hasPermission(Permission.MANAGE_REQUESTS)
            ? 'success'
            : hasPermission(Permission.REQUEST_ADVANCED)
            ? 'primary'
            : 'danger'
        }
        onSecondary={
          isOwner &&
          hasPermission(
            [Permission.REQUEST_ADVANCED, Permission.MANAGE_REQUESTS],
            { type: 'or' }
          )
            ? () => cancelRequest()
            : undefined
        }
        secondaryDisabled={isUpdating}
        secondaryText={
          isOwner &&
          hasPermission(
            [Permission.REQUEST_ADVANCED, Permission.MANAGE_REQUESTS],
            { type: 'or' }
          )
            ? intl.formatMessage(messages.cancel)
            : undefined
        }
        secondaryButtonType="danger"
        cancelText={intl.formatMessage(globalMessages.close)}
      >
        {isOwner
          ? intl.formatMessage(messages.pendingapproval)
          : intl.formatMessage(messages.requestfrom, {
              username: editRequest.requestedBy.displayName,
            })}
        {(hasPermission(Permission.REQUEST_ADVANCED) ||
          hasPermission(Permission.MANAGE_REQUESTS)) && (
          <AdvancedRequester
            type="music"
            is4k={false}
            requestUser={editRequest.requestedBy}
            defaultOverrides={{
              folder: editRequest.rootFolder,
              profile: editRequest.profileId,
              server: editRequest.serverId,
              tags: editRequest.tags,
            }}
            onChange={(overrides) => {
              setRequestOverrides(overrides);
            }}
          />
        )}
      </Modal>
    );
  }

  const hasAutoApprove = hasPermission(
    [Permission.MANAGE_REQUESTS, Permission.AUTO_APPROVE],
    { type: 'or' }
  );

  return (
    <Modal
      loading={(!data && !error) || !quota}
      backgroundClickable
      onCancel={onCancel}
      onOk={sendRequest}
      okDisabled={isUpdating || quota?.music?.restricted}
      title={intl.formatMessage(messages.requestmusictitle)}
      subTitle={data ? `${data.artist.artistName} - ${data.title}` : undefined}
      okText={
        isUpdating
          ? intl.formatMessage(globalMessages.requesting)
          : intl.formatMessage(globalMessages.request)
      }
      okButtonType="primary"
      backdrop={
        data?.artist?.images?.find((img) => img.CoverType === 'Fanart')?.Url ||
        data?.artist?.images?.find((img) => img.CoverType === 'Poster')?.Url ||
        data?.images?.find((img) => img.CoverType.toLowerCase() === 'cover')
          ?.Url
      }
    >
      {hasAutoApprove && !quota?.music?.restricted && (
        <div className="mt-6">
          <Alert
            title={intl.formatMessage(messages.requestadmin)}
            type="info"
          />
        </div>
      )}
      {(quota?.music?.limit ?? 0) > 0 && (
        <QuotaDisplay
          mediaType="music"
          quota={quota?.music}
          userOverride={
            requestOverrides?.user && requestOverrides.user.id !== user?.id
              ? requestOverrides?.user?.id
              : undefined
          }
        />
      )}
      {(hasPermission(Permission.REQUEST_ADVANCED) ||
        hasPermission(Permission.MANAGE_REQUESTS)) && (
        <AdvancedRequester
          type="music"
          is4k={false}
          onChange={(overrides) => {
            setRequestOverrides(overrides);
          }}
        />
      )}
    </Modal>
  );
};

export default MusicRequestModal;
