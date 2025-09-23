import ButtonWithDropdown from '@app/components/Common/ButtonWithDropdown';
import RequestModal from '@app/components/RequestModal';
import useSettings from '@app/hooks/useSettings';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import {
  CheckIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import type Media from '@server/entity/Media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import axios from 'axios';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { mutate } from 'swr';

const messages = defineMessages('components.RequestButton', {
  viewrequest: 'View Request',
  viewrequest4k: 'View 4K Request',
  viewrequestaudiobook: 'View Audiobook Request',
  requestmore: 'Request More',
  requestmore4k: 'Request More in 4K',
  requestmoreaudiobook: 'Request More Audiobook',
  approverequest: 'Approve Request',
  approverequest4k: 'Approve 4K Request',
  approverequestaudiobook: 'Approve Audiobook Request',
  declinerequest: 'Decline Request',
  declinerequest4k: 'Decline 4K Request',
  declinerequestaudiobook: 'Decline Audiobook Request',
  approverequests:
    'Approve {requestCount, plural, one {Request} other {{requestCount} Requests}}',
  declinerequests:
    'Decline {requestCount, plural, one {Request} other {{requestCount} Requests}}',
  approve4krequests:
    'Approve {requestCount, plural, one {4K Request} other {{requestCount} 4K Requests}}',
  decline4krequests:
    'Decline {requestCount, plural, one {4K Request} other {{requestCount} 4K Requests}}',
});

interface ButtonOption {
  id: string;
  text: string;
  action: () => void;
  svg?: React.ReactNode;
}

interface RequestButtonProps {
  mediaType: 'movie' | 'tv' | 'book';
  onUpdate: () => void;
  mediaId: number;
  media?: Media;
  isShowComplete?: boolean;
  is4kShowComplete?: boolean;
}

const RequestButton = ({
  mediaId,
  onUpdate,
  media,
  mediaType,
  isShowComplete = false,
  is4kShowComplete = false,
}: RequestButtonProps) => {
  const intl = useIntl();
  const settings = useSettings();
  const { user, hasPermission } = useUser();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showRequestAltModal, setShowRequestAltModal] = useState(false);
  const [editRequest, setEditRequest] = useState(false);

  // All pending requests
  const activeRequests = media?.requests.filter(
    (request) => request.status === MediaRequestStatus.PENDING && !request.isAlt
  );
  const activeAltRequests = media?.requests.filter(
    (request) => request.status === MediaRequestStatus.PENDING && request.isAlt
  );

  // Current user's pending request, or the first pending request
  const activeRequest = useMemo(() => {
    return activeRequests && activeRequests.length > 0
      ? activeRequests.find((request) => request.requestedBy.id === user?.id) ??
          activeRequests[0]
      : undefined;
  }, [activeRequests, user]);
  const activeAltRequest = useMemo(() => {
    return activeAltRequests && activeAltRequests.length > 0
      ? activeAltRequests.find(
          (request) => request.requestedBy.id === user?.id
        ) ?? activeAltRequests[0]
      : undefined;
  }, [activeAltRequests, user]);

  const modifyRequest = async (
    request: MediaRequest,
    type: 'approve' | 'decline'
  ) => {
    const response = await axios.post(`/api/v1/request/${request.id}/${type}`);

    if (response) {
      onUpdate();
      mutate('/api/v1/request/count');
    }
  };

  const modifyRequests = async (
    requests: MediaRequest[],
    type: 'approve' | 'decline'
  ): Promise<void> => {
    if (!requests) {
      return;
    }

    await Promise.all(
      requests.map(async (request) => {
        return axios.post(`/api/v1/request/${request.id}/${type}`);
      })
    );

    onUpdate();
    mutate('/api/v1/request/count');
  };

  const buttons: ButtonOption[] = [];

  // If there are pending requests, show request management options first
  if (activeRequest || activeAltRequest) {
    if (
      activeRequest &&
      (activeRequest.requestedBy.id === user?.id ||
        (activeRequests?.length === 1 &&
          hasPermission(Permission.MANAGE_REQUESTS)))
    ) {
      buttons.push({
        id: 'active-request',
        text: intl.formatMessage(messages.viewrequest),
        action: () => {
          setEditRequest(true);
          setShowRequestModal(true);
        },
        svg: <InformationCircleIcon />,
      });
    }

    if (
      activeRequest &&
      hasPermission(Permission.MANAGE_REQUESTS) &&
      (mediaType === 'movie' || mediaType === 'book')
    ) {
      buttons.push(
        {
          id: 'approve-request',
          text: intl.formatMessage(messages.approverequest),
          action: () => {
            modifyRequest(activeRequest, 'approve');
          },
          svg: <CheckIcon />,
        },
        {
          id: 'decline-request',
          text: intl.formatMessage(messages.declinerequest),
          action: () => {
            modifyRequest(activeRequest, 'decline');
          },
          svg: <XMarkIcon />,
        }
      );
    } else if (
      activeRequests &&
      activeRequests.length > 0 &&
      hasPermission(Permission.MANAGE_REQUESTS) &&
      mediaType === 'tv'
    ) {
      buttons.push(
        {
          id: 'approve-request-batch',
          text: intl.formatMessage(messages.approverequests, {
            requestCount: activeRequests.length,
          }),
          action: () => {
            modifyRequests(activeRequests, 'approve');
          },
          svg: <CheckIcon />,
        },
        {
          id: 'decline-request-batch',
          text: intl.formatMessage(messages.declinerequests, {
            requestCount: activeRequests.length,
          }),
          action: () => {
            modifyRequests(activeRequests, 'decline');
          },
          svg: <XMarkIcon />,
        }
      );
    }

    if (
      activeAltRequest &&
      (activeAltRequest.requestedBy.id === user?.id ||
        (activeAltRequests?.length === 1 &&
          hasPermission(Permission.MANAGE_REQUESTS)))
    ) {
      buttons.push({
        id: 'active-alt-request',
        text: intl.formatMessage(
          mediaType === 'book'
            ? messages.viewrequestaudiobook
            : messages.viewrequest4k
        ),
        action: () => {
          setEditRequest(true);
          setShowRequestAltModal(true);
        },
        svg: <InformationCircleIcon />,
      });
    }

    if (
      activeAltRequest &&
      hasPermission(Permission.MANAGE_REQUESTS) &&
      (mediaType === 'movie' || mediaType === 'book')
    ) {
      buttons.push(
        {
          id: 'approve-alt-request',
          text: intl.formatMessage(
            mediaType === 'book'
              ? messages.approverequestaudiobook
              : messages.approverequest4k
          ),
          action: () => {
            modifyRequest(activeAltRequest, 'approve');
          },
          svg: <CheckIcon />,
        },
        {
          id: 'decline-alt-request',
          text: intl.formatMessage(
            mediaType === 'book'
              ? messages.declinerequestaudiobook
              : messages.declinerequest4k
          ),
          action: () => {
            modifyRequest(activeAltRequest, 'decline');
          },
          svg: <XMarkIcon />,
        }
      );
    } else if (
      activeAltRequests &&
      activeAltRequests.length > 0 &&
      hasPermission(Permission.MANAGE_REQUESTS) &&
      mediaType === 'tv'
    ) {
      buttons.push(
        {
          id: 'approve-alt-request-batch',
          text: intl.formatMessage(messages.approve4krequests, {
            requestCount: activeAltRequests.length,
          }),
          action: () => {
            modifyRequests(activeAltRequests, 'approve');
          },
          svg: <CheckIcon />,
        },
        {
          id: 'decline-alt-request-batch',
          text: intl.formatMessage(messages.decline4krequests, {
            requestCount: activeAltRequests.length,
          }),
          action: () => {
            modifyRequests(activeAltRequests, 'decline');
          },
          svg: <XMarkIcon />,
        }
      );
    }
  }

  // Standard request button
  if (
    (!media ||
      media.status === MediaStatus.UNKNOWN ||
      (media.status === MediaStatus.DELETED && !activeRequest)) &&
    hasPermission(
      [
        Permission.REQUEST,
        mediaType === 'movie'
          ? Permission.REQUEST_MOVIE
          : mediaType === 'tv'
          ? Permission.REQUEST_TV
          : Permission.REQUEST_BOOK,
      ],
      { type: 'or' }
    )
  ) {
    buttons.push({
      id: 'request',
      text: intl.formatMessage(globalMessages.request),
      action: () => {
        setEditRequest(false);
        setShowRequestModal(true);
      },
      svg: <ArrowDownTrayIcon />,
    });
  } else if (
    mediaType === 'tv' &&
    (!activeRequest || activeRequest.requestedBy.id !== user?.id) &&
    hasPermission([Permission.REQUEST, Permission.REQUEST_TV], {
      type: 'or',
    }) &&
    media &&
    media.status !== MediaStatus.BLACKLISTED &&
    !isShowComplete
  ) {
    buttons.push({
      id: 'request-more',
      text: intl.formatMessage(messages.requestmore),
      action: () => {
        setEditRequest(false);
        setShowRequestModal(true);
      },
      svg: <ArrowDownTrayIcon />,
    });
  }

  // 4K/Alt request button
  if (
    (!media ||
      media.statusAlt === MediaStatus.UNKNOWN ||
      (media.statusAlt === MediaStatus.DELETED && !activeAltRequest)) &&
    hasPermission(
      [
        Permission.REQUEST_ALT,
        mediaType === 'movie'
          ? Permission.REQUEST_4K_MOVIE
          : mediaType === 'tv'
          ? Permission.REQUEST_4K_TV
          : Permission.REQUEST_AUDIO_BOOK,
      ],
      { type: 'or' }
    ) &&
    ((settings.currentSettings.movie4kEnabled && mediaType === 'movie') ||
      (settings.currentSettings.series4kEnabled && mediaType === 'tv') ||
      (settings.currentSettings.bookAudioEnabled && mediaType === 'book'))
  ) {
    buttons.push({
      id: 'requestAlt',
      text: intl.formatMessage(
        mediaType === 'book'
          ? globalMessages.requestAudio
          : globalMessages.request4k
      ),
      action: () => {
        setEditRequest(false);
        setShowRequestAltModal(true);
      },
      svg: <ArrowDownTrayIcon />,
    });
  } else if (
    mediaType === 'tv' &&
    (!activeAltRequest || activeAltRequest.requestedBy.id !== user?.id) &&
    hasPermission([Permission.REQUEST_ALT, Permission.REQUEST_4K_TV], {
      type: 'or',
    }) &&
    media &&
    media.statusAlt !== MediaStatus.BLACKLISTED &&
    !is4kShowComplete &&
    settings.currentSettings.series4kEnabled
  ) {
    buttons.push({
      id: 'request-more-alt',
      text: intl.formatMessage(messages.requestmore4k),
      action: () => {
        setEditRequest(false);
        setShowRequestAltModal(true);
      },
      svg: <ArrowDownTrayIcon />,
    });
  }

  const [buttonOne, ...others] = buttons;

  if (!buttonOne) {
    return null;
  }

  return (
    <>
      <RequestModal
        mediaId={mediaId}
        show={showRequestModal}
        type={mediaType}
        editRequest={editRequest ? activeRequest : undefined}
        onComplete={() => {
          onUpdate();
          setShowRequestModal(false);
        }}
        onCancel={() => {
          setShowRequestModal(false);
        }}
      />
      <RequestModal
        mediaId={mediaId}
        show={showRequestAltModal}
        type={mediaType}
        editRequest={editRequest ? activeAltRequest : undefined}
        isAlt
        onComplete={() => {
          onUpdate();
          setShowRequestAltModal(false);
        }}
        onCancel={() => setShowRequestAltModal(false)}
      />
      <ButtonWithDropdown
        text={
          <>
            {buttonOne.svg}
            <span>{buttonOne.text}</span>
          </>
        }
        onClick={buttonOne.action}
        className="ml-2"
      >
        {others && others.length > 0
          ? others.map((button) => (
              <ButtonWithDropdown.Item
                onClick={button.action}
                key={`request-option-${button.id}`}
              >
                {button.svg}
                <span>{button.text}</span>
              </ButtonWithDropdown.Item>
            ))
          : null}
      </ButtonWithDropdown>
    </>
  );
};

export default RequestButton;
