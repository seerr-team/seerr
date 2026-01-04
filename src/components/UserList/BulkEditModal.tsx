import Modal from '@app/components/Common/Modal';
import PermissionEdit from '@app/components/PermissionEdit';
import type { User } from '@app/hooks/useUser';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { hasPermission } from '@server/lib/permissions';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';

interface BulkEditProps {
  selectedUserIds: number[];
  users?: User[];
  onCancel?: () => void;
  onComplete?: (updatedUsers: User[]) => void;
  onSaving?: (isSaving: boolean) => void;
}

const messages = defineMessages('components.UserList', {
  userssaved: 'User permissions saved successfully!',
  userfail: 'Something went wrong while saving user permissions.',
  edituser: 'Edit User Permissions',
});

const BulkEditModal = ({
  selectedUserIds,
  users,
  onCancel,
  onComplete,
  onSaving,
}: BulkEditProps) => {
  const { user: currentUser } = useUser();
  const intl = useIntl();
  const { addToast } = useToasts();
  const [currentPermission, setCurrentPermission] = useState(0);
  const [currentMaxMovieRating, setCurrentMaxMovieRating] = useState<
    string | undefined
  >(undefined);
  const [currentMaxTvRating, setCurrentMaxTvRating] = useState<
    string | undefined
  >(undefined);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (onSaving) {
      onSaving(isSaving);
    }
  }, [isSaving, onSaving]);

  const updateUsers = async () => {
    try {
      setIsSaving(true);
      const { data: updated } = await axios.put<User[]>(`/api/v1/user`, {
        ids: selectedUserIds,
        permissions: currentPermission,
        maxMovieRating: currentMaxMovieRating || '',
        maxTvRating: currentMaxTvRating || '',
      });
      if (onComplete) {
        onComplete(updated);
      }
      addToast(intl.formatMessage(messages.userssaved), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (e) {
      addToast(intl.formatMessage(messages.userfail), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (users) {
      const selectedUsers = users.filter((u) => selectedUserIds.includes(u.id));
      const { permissions: allPermissionsEqual } = selectedUsers.reduce(
        ({ permissions: aPerms }, { permissions: bPerms }) => {
          return {
            permissions:
              aPerms === bPerms || hasPermission(Permission.ADMIN, aPerms)
                ? aPerms
                : NaN,
          };
        },
        { permissions: selectedUsers[0].permissions }
      );
      if (allPermissionsEqual) {
        setCurrentPermission(allPermissionsEqual);
      }

      // Set initial content rating values from first selected user
      if (selectedUsers.length > 0 && selectedUsers[0].settings) {
        setCurrentMaxMovieRating(selectedUsers[0].settings.maxMovieRating);
        setCurrentMaxTvRating(selectedUsers[0].settings.maxTvRating);
      }
    }
  }, [users, selectedUserIds]);

  return (
    <Modal
      title={intl.formatMessage(messages.edituser)}
      onOk={() => {
        updateUsers();
      }}
      okDisabled={isSaving}
      okText={intl.formatMessage(globalMessages.save)}
      onCancel={onCancel}
    >
      <div className="mb-6">
        <PermissionEdit
          actingUser={currentUser}
          currentPermission={currentPermission}
          onUpdate={(newPermission) => setCurrentPermission(newPermission)}
        />
      </div>
      {hasPermission(
        Permission.MANAGE_USERS,
        currentUser?.permissions ?? 0
      ) && (
        <div className="mb-6">
          <h3 className="mb-2 text-lg font-semibold">Content Filtering</h3>
          <div className="mb-4">
            <label htmlFor="maxMovieRating" className="text-label">
              Max Movie Rating
            </label>
            <select
              id="maxMovieRating"
              className="w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white"
              value={currentMaxMovieRating || ''}
              onChange={(e) =>
                setCurrentMaxMovieRating(e.target.value || undefined)
              }
            >
              <option value="">No Restriction</option>
              <option value="G">G</option>
              <option value="PG">PG</option>
              <option value="PG-13">PG-13</option>
              <option value="R">R</option>
              <option value="NC-17">NC-17</option>
              <option value="NR">NR (Allow Unrated)</option>
            </select>
          </div>
          <div className="mb-4">
            <label htmlFor="maxTvRating" className="text-label">
              Max TV Rating
            </label>
            <select
              id="maxTvRating"
              className="w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white"
              value={currentMaxTvRating || ''}
              onChange={(e) =>
                setCurrentMaxTvRating(e.target.value || undefined)
              }
            >
              <option value="">No Restriction</option>
              <option value="TV-Y">TV-Y</option>
              <option value="TV-Y7">TV-Y7</option>
              <option value="TV-G">TV-G</option>
              <option value="TV-PG">TV-PG</option>
              <option value="TV-14">TV-14</option>
              <option value="TV-MA">TV-MA</option>
              <option value="NR">NR (Allow Unrated)</option>
            </select>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default BulkEditModal;
