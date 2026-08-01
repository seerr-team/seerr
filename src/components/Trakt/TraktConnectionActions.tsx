import Alert from '@app/components/Common/Alert';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import ConfirmButton from '@app/components/Common/ConfirmButton';
import TraktOAuthModal from '@app/components/Trakt/TraktOAuthModal';
import defineMessages from '@app/utils/defineMessages';
import { ArrowPathIcon, LinkIcon, TrashIcon } from '@heroicons/react/24/solid';
import type { TraktConnectionResponse } from '@server/interfaces/api/traktInterfaces';
import axios from 'axios';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Trakt.TraktConnectionActions', {
  connected: 'Connected',
  reconnectRequired: 'Reconnect required',
  notConnected: 'Not connected',
  connect: 'Connect',
  reconnect: 'Reconnect',
  unlink: 'Unlink',
  unlinking: 'Unlinking…',
  unlinkConfirm: 'Confirm unlink',
  unlinkFailed: 'The Trakt connection could not be removed.',
  revokeWarning:
    'The local connection was removed, but Trakt could not revoke its token. Revoke Seerr from the Trakt website.',
  unnamedAccount: 'Trakt account',
});

export const traktAccountName = (
  connection: TraktConnectionResponse | null
): string | null =>
  connection?.traktUsername ??
  connection?.displayName ??
  connection?.traktSlug ??
  null;

interface TraktConnectionActionsProps {
  targetUserId: number;
  targetUserDisplayName: string;
  connection: TraktConnectionResponse | null;
  applicationConfigured: boolean;
  onRefresh: () => void | Promise<unknown>;
  className?: string;
  showOAuthActions?: boolean;
  /** Omit the name and status block when the surrounding row already shows them. */
  hideIdentity?: boolean;
}

const TraktConnectionActions = ({
  targetUserId,
  targetUserDisplayName,
  connection,
  applicationConfigured,
  onRefresh,
  className,
  showOAuthActions = true,
  hideIdentity = false,
}: TraktConnectionActionsProps) => {
  const intl = useIntl();
  const [oauthModal, setOAuthModal] = useState<{
    targetUserId: number;
    targetUserDisplayName: string;
    initialPopup: Window | null;
  } | null>(null);
  const [unlinkError, setUnlinkError] = useState(false);
  const [revokeWarning, setRevokeWarning] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const startOAuth = () => {
    const popup = window.open(
      'about:blank',
      'trakt-oauth',
      'popup,width=640,height=760'
    );
    setOAuthModal({ targetUserId, targetUserDisplayName, initialPopup: popup });
  };

  const unlink = async () => {
    setUnlinking(true);
    setUnlinkError(false);
    setRevokeWarning(false);
    try {
      const { data } = await axios.delete<{
        remoteRevocationSucceeded: boolean;
      }>(`/api/v1/user/${targetUserId}/settings/trakt`);
      if (!data.remoteRevocationSucceeded) {
        setRevokeWarning(true);
      }
      await onRefresh();
    } catch {
      setUnlinkError(true);
    } finally {
      setUnlinking(false);
    }
  };

  const accountName =
    traktAccountName(connection) ?? intl.formatMessage(messages.unnamedAccount);

  return (
    <div className={className}>
      {oauthModal && (
        <TraktOAuthModal
          targetUserId={oauthModal.targetUserId}
          targetUserDisplayName={oauthModal.targetUserDisplayName}
          initialPopup={oauthModal.initialPopup}
          onConnected={() => {
            setOAuthModal(null);
            void onRefresh();
          }}
          onCancel={() => setOAuthModal(null)}
        />
      )}
      {unlinkError && (
        <Alert title={intl.formatMessage(messages.unlinkFailed)} type="error" />
      )}
      {revokeWarning && (
        <Alert
          title={intl.formatMessage(messages.revokeWarning)}
          type="warning"
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        {!hideIdentity && (
          <div className="min-w-0 flex-1">
            {connection ? (
              <div className="truncate font-medium text-white">
                {accountName}
              </div>
            ) : (
              <div className="text-gray-300">
                {intl.formatMessage(messages.notConnected)}
              </div>
            )}
            {connection?.status === 'active' && (
              <Badge badgeType="success">
                {intl.formatMessage(messages.connected)}
              </Badge>
            )}
            {connection?.status === 'reconnect_required' && (
              <Badge badgeType="warning">
                {intl.formatMessage(messages.reconnectRequired)}
              </Badge>
            )}
          </div>
        )}
        {!connection && showOAuthActions && (
          <Button
            buttonType="primary"
            onClick={startOAuth}
            disabled={!applicationConfigured}
          >
            <LinkIcon />
            <span>{intl.formatMessage(messages.connect)}</span>
          </Button>
        )}
        {connection && showOAuthActions && (
          <Button
            buttonType={
              connection.status === 'reconnect_required' ? 'warning' : 'primary'
            }
            onClick={startOAuth}
            disabled={!applicationConfigured}
          >
            <ArrowPathIcon />
            <span>{intl.formatMessage(messages.reconnect)}</span>
          </Button>
        )}
        {connection && (
          <ConfirmButton
            onClick={() => void unlink()}
            confirmText={intl.formatMessage(messages.unlinkConfirm)}
            disabled={unlinking}
          >
            <TrashIcon />
            <span>
              {intl.formatMessage(
                unlinking ? messages.unlinking : messages.unlink
              )}
            </span>
          </ConfirmButton>
        )}
      </div>
    </div>
  );
};

export default TraktConnectionActions;
