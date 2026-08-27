import Alert from '@app/components/Common/Alert';
import Modal from '@app/components/Common/Modal';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import type {
  TraktAuthorizationResponse,
  TraktOAuthStatusResponse,
  TraktSafeResultCode,
} from '@server/interfaces/api/traktInterfaces';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Trakt.TraktOAuthModal', {
  targetTitle: 'Connect Trakt for {targetUserDisplayName}',
  starting: 'Preparing a secure Trakt login…',
  waiting: 'Complete the sign-in in the Trakt window.',
  openTrakt: 'Open Trakt',
  retry: 'Retry',
  popupClosed: 'Trakt login was closed',
  popupClosedDescription:
    'Retry to start a new secure Trakt login transaction.',
  unknownError: 'Trakt could not be connected. Please try again.',
  accessDenied: 'Trakt access was denied.',
  actorNotAuthorized: 'You are not allowed to connect Trakt for this user.',
  clientIdChanged:
    'The Trakt client ID changed while you were signing in. Please retry.',
  confirmReconnectAllRequired:
    'The Trakt application change must be confirmed by an administrator.',
  invalidState: 'The Trakt login response was invalid. Please retry.',
  interrupted: 'The Trakt login was interrupted. Please retry.',
  expired: 'The Trakt login expired. Please retry.',
  replayed: 'This Trakt login was already used. Please retry.',
  duplicateTarget:
    'This Seerr user is already connected to another Trakt account.',
  targetMissing: 'The selected Seerr user no longer exists.',
  tokenExchangeFailed: 'Trakt could not finish the login. Please retry.',
  duplicateIdentity: 'This Trakt account belongs to another Seerr user.',
  notConfigured: 'Trakt has not been configured by an administrator.',
});

export interface TraktOAuthModalProps {
  targetUserId: number;
  targetUserDisplayName: string;
  initialPopup: Window | null;
  onConnected: () => void;
  onCancel: () => void;
}

type ModalState = 'starting' | 'waiting' | 'popup_closed' | 'failed';

const popupFeatures = 'popup,width=640,height=760';

const TraktOAuthModal = ({
  targetUserId,
  targetUserDisplayName,
  initialPopup,
  onConnected,
  onCancel,
}: TraktOAuthModalProps) => {
  const intl = useIntl();
  const popupRef = useRef<Window | null>(initialPopup);
  const mountedRef = useRef(true);
  const [attempt, setAttempt] = useState(0);
  const [popupEpoch, setPopupEpoch] = useState(0);
  const [authorization, setAuthorization] =
    useState<TraktAuthorizationResponse | null>(null);
  const [state, setState] = useState<ModalState>('starting');
  const [resultCode, setResultCode] = useState<TraktSafeResultCode | null>(
    null
  );

  const closePopup = useCallback(() => {
    const popup = popupRef.current;
    if (popup && !popup.closed) {
      popup.close();
    }
    popupRef.current = null;
  }, []);

  const finishWithStatus = useCallback(
    (status: TraktOAuthStatusResponse) => {
      if (status.status === 'pending') {
        return false;
      }
      closePopup();
      if (status.status === 'succeeded') {
        onConnected();
      } else {
        setResultCode(status.resultCode);
        setState('failed');
      }
      return true;
    },
    [closePopup, onConnected]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      closePopup();
    };
  }, [closePopup]);

  useEffect(() => {
    const controller = new AbortController();
    setAuthorization(null);
    setResultCode(null);
    setState('starting');

    axios
      .post<TraktAuthorizationResponse>(
        `/api/v1/user/${targetUserId}/settings/trakt/auth`,
        undefined,
        { signal: controller.signal }
      )
      .then(({ data }) => {
        if (!mountedRef.current || controller.signal.aborted) {
          return;
        }
        setAuthorization(data);
        const popup = popupRef.current;
        if (popup && !popup.closed) {
          popup.location.href = data.authorizationUrl;
          setState('waiting');
        } else {
          popupRef.current = null;
          setState('popup_closed');
        }
      })
      .catch((error) => {
        if (!axios.isCancel(error) && mountedRef.current) {
          closePopup();
          setResultCode(error?.response?.data?.code ?? null);
          setState('failed');
        }
      });

    return () => controller.abort();
  }, [attempt, closePopup, targetUserId]);

  useEffect(() => {
    if (!authorization || state !== 'waiting') {
      return;
    }

    let stopped = false;
    let terminal = false;
    let checkInFlight = false;
    let checkQueued = false;
    let popupClosePending = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let popupTimer: ReturnType<typeof setInterval> | undefined = undefined;
    const controller = new AbortController();

    const stop = () => {
      stopped = true;
      controller.abort();
      if (pollTimer) clearTimeout(pollTimer);
      if (popupTimer) clearInterval(popupTimer);
      window.removeEventListener('message', handleMessage);
    };

    const checkStatus = async () => {
      if (stopped || terminal) return;
      if (checkInFlight) {
        checkQueued = true;
        return;
      }
      checkInFlight = true;
      const isFinalPopupCloseCheck = popupClosePending;
      try {
        const { data } = await axios.get<TraktOAuthStatusResponse>(
          `/api/v1/trakt/oauth/${authorization.transactionId}/status`,
          { signal: controller.signal }
        );
        if (stopped || terminal) return;
        if (data.status !== 'pending') {
          terminal = true;
          stop();
          finishWithStatus(data);
          return;
        }
        if (isFinalPopupCloseCheck) {
          terminal = true;
          stop();
          setState('popup_closed');
          return;
        }
      } catch (error) {
        if (stopped || axios.isCancel(error)) return;
        terminal = true;
        stop();
        const code = error?.response?.data?.code as
          | TraktSafeResultCode
          | undefined;
        setResultCode(code ?? null);
        setState('failed');
        closePopup();
        return;
      } finally {
        checkInFlight = false;
      }
      if (checkQueued) {
        checkQueued = false;
        void checkStatus();
      } else {
        pollTimer = setTimeout(checkStatus, 2000);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: unknown;
        transactionId?: unknown;
      } | null;
      if (
        event.origin !== authorization.callbackOrigin ||
        !data ||
        data.type !== 'trakt-oauth-result' ||
        data.transactionId !== authorization.transactionId
      ) {
        return;
      }
      void checkStatus();
    };

    window.addEventListener('message', handleMessage);
    void checkStatus();
    popupTimer = setInterval(() => {
      if (!stopped && popupRef.current?.closed) {
        popupRef.current = null;
        popupClosePending = true;
        if (pollTimer) {
          clearTimeout(pollTimer);
          pollTimer = undefined;
        }
        if (popupTimer) {
          clearInterval(popupTimer);
          popupTimer = undefined;
        }
        void checkStatus();
      }
    }, 500);

    return stop;
  }, [authorization, closePopup, finishWithStatus, popupEpoch, state]);

  const openTrakt = () => {
    if (!authorization) return;
    const popup = window.open(
      authorization.authorizationUrl,
      'trakt-oauth',
      popupFeatures
    );
    popupRef.current = popup;
    if (popup) {
      setPopupEpoch((value) => value + 1);
      setState('waiting');
    }
  };

  const retry = () => {
    closePopup();
    popupRef.current = window.open('about:blank', 'trakt-oauth', popupFeatures);
    setAttempt((value) => value + 1);
  };

  const cancel = () => {
    closePopup();
    onCancel();
  };

  const resultMessage = (() => {
    switch (resultCode) {
      case 'access_denied':
        return messages.accessDenied;
      case 'actor_not_authorized':
        return messages.actorNotAuthorized;
      case 'client_id_changed':
        return messages.clientIdChanged;
      case 'confirm_reconnect_all_required':
        return messages.confirmReconnectAllRequired;
      case 'invalid_state':
        return messages.invalidState;
      case 'oauth_interrupted':
        return messages.interrupted;
      case 'state_expired':
        return messages.expired;
      case 'state_replayed':
        return messages.replayed;
      case 'target_has_different_trakt_account':
        return messages.duplicateTarget;
      case 'target_missing':
        return messages.targetMissing;
      case 'token_exchange_failed':
        return messages.tokenExchangeFailed;
      case 'trakt_account_owned_by_another_user':
        return messages.duplicateIdentity;
      case 'trakt_application_not_configured':
        return messages.notConfigured;
      default:
        return messages.unknownError;
    }
  })();

  return (
    <Transition
      as="div"
      show
      enter="transition-opacity duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <Modal
        title={intl.formatMessage(messages.targetTitle, {
          targetUserDisplayName,
        })}
        onCancel={cancel}
        onOk={state === 'popup_closed' ? openTrakt : undefined}
        okText={intl.formatMessage(messages.openTrakt)}
        onSecondary={
          state === 'popup_closed' || state === 'failed' ? retry : undefined
        }
        secondaryText={intl.formatMessage(messages.retry)}
        backgroundClickable={false}
        dialogClass="sm:max-w-lg"
      >
        {state === 'starting' && intl.formatMessage(messages.starting)}
        {state === 'waiting' && intl.formatMessage(messages.waiting)}
        {state === 'popup_closed' && (
          <Alert
            title={intl.formatMessage(messages.popupClosed)}
            type="warning"
          >
            {intl.formatMessage(messages.popupClosedDescription)}
          </Alert>
        )}
        {state === 'failed' && (
          <Alert title={intl.formatMessage(resultMessage)} type="error" />
        )}
      </Modal>
    </Transition>
  );
};

export default TraktOAuthModal;
