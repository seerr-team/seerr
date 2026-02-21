import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import type { User } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import type { UserResultsResponse } from '@server/interfaces/api/userInterfaces';
import axios from 'axios';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserGeneralSettings.MergeUserModal',
  {
    mergeuser: 'Merge User',
    merging: 'Merging…',
    merge: 'Merge',
    usermerged: 'User merged successfully!',
    usermergeerror: 'Something went wrong while merging the user.',
    mergeconfirm:
      'Select the user to merge into. All requests, issues, and watchlist items will be transferred to the target user, and this account will be deleted.',
    targetuser: 'Merge Into',
    selectuser: 'Select a user...',
  }
);

interface MergeUserModalProps {
  user: User;
  onComplete: () => void;
  onCancel: () => void;
}

const MergeUserModal = ({ user, onComplete, onCancel }: MergeUserModalProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [isMerging, setMerging] = useState(false);
  const [targetUserId, setTargetUserId] = useState<number | null>(null);

  // Fetch all users to populate the dropdown
  const { data: usersData } = useSWR<UserResultsResponse>(
    '/api/v1/user?take=100&skip=0&sort=displayname'
  );

  const mergeUser = async () => {
    if (!targetUserId) return;

    setMerging(true);

    try {
      await axios.post(`/api/v1/user/${user.id}/merge`, {
        targetUserId,
      });

      addToast(intl.formatMessage(messages.usermerged), {
        autoDismiss: true,
        appearance: 'success',
      });
      onComplete();
    } catch (e) {
      addToast(intl.formatMessage(messages.usermergeerror), {
        autoDismiss: true,
        appearance: 'error',
      });
      setMerging(false);
    }
  };

  // Filter out the source user from the list of potential targets
  const availableTargets =
    usersData?.results.filter((u) => u.id !== user.id) ?? [];

  return (
    <Modal
      onOk={() => mergeUser()}
      okText={
        isMerging
          ? intl.formatMessage(messages.merging)
          : intl.formatMessage(messages.merge)
      }
      okDisabled={isMerging || !targetUserId}
      okButtonType="danger"
      onCancel={onCancel}
      title={intl.formatMessage(messages.mergeuser)}
      subTitle={user.displayName}
    >
      <p className="mb-4 text-gray-300">
        {intl.formatMessage(messages.mergeconfirm)}
      </p>
      {!usersData ? (
        <LoadingSpinner />
      ) : (
        <div className="form-row">
          <label htmlFor="targetUser" className="text-label">
            {intl.formatMessage(messages.targetuser)}
          </label>
          <div className="form-input-area">
            <select
              id="targetUser"
              name="targetUser"
              value={targetUserId ?? ''}
              onChange={(e) =>
                setTargetUserId(e.target.value ? Number(e.target.value) : null)
              }
              className="block w-full rounded-md border border-gray-600 bg-gray-700 text-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">
                {intl.formatMessage(messages.selectuser)}
              </option>
              {availableTargets.map((targetUser) => (
                <option key={targetUser.id} value={targetUser.id}>
                  {targetUser.displayName}
                  {targetUser.email &&
                    targetUser.displayName.toLowerCase() !== targetUser.email &&
                    ` (${targetUser.email})`}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default MergeUserModal;
