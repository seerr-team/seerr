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
  contentfiltering: 'Content Filtering',
  maxmovierating: 'Max Movie Rating',
  maxtvrating: 'Max TV Rating',
  norestriction: 'No Restriction',
  blockunrated: 'Block Unrated Content',
  blockadult: 'Block Adult Content',
});

const MOVIE_RATINGS = [
  { value: '', label: 'No Restriction' },
  { value: 'G', label: 'G - General Audiences' },
  { value: 'PG', label: 'PG - Parental Guidance Suggested' },
  { value: 'PG-13', label: 'PG-13 - Parents Strongly Cautioned' },
  { value: 'R', label: 'R - Restricted' },
  { value: 'NC-17', label: 'NC-17 - Adults Only' },
];

const TV_RATINGS = [
  { value: '', label: 'No Restriction' },
  { value: 'TV-Y', label: 'TV-Y - All Children' },
  { value: 'TV-Y7', label: 'TV-Y7 - Directed to Older Children' },
  { value: 'TV-G', label: 'TV-G - General Audience' },
  { value: 'TV-PG', label: 'TV-PG - Parental Guidance Suggested' },
  { value: 'TV-14', label: 'TV-14 - Parents Strongly Cautioned' },
  { value: 'TV-MA', label: 'TV-MA - Mature Audience Only' },
];

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
  const [currentBlockUnrated, setCurrentBlockUnrated] = useState(false);
  const [currentBlockAdult, setCurrentBlockAdult] = useState(false);
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
        blockUnrated: currentBlockUnrated,
        blockAdult: currentBlockAdult,
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
          <h3 className="mb-2 text-lg font-semibold">
            {intl.formatMessage(messages.contentfiltering)}
          </h3>
          <div className="mb-4">
            <label htmlFor="maxMovieRating" className="text-label">
              {intl.formatMessage(messages.maxmovierating)}
            </label>
            <div className="form-input-area">
              <div className="form-input-field">
                <select
                  id="maxMovieRating"
                  value={currentMaxMovieRating || ''}
                  onChange={(e) =>
                    setCurrentMaxMovieRating(e.target.value || undefined)
                  }
                >
                  {MOVIE_RATINGS.map((rating) => (
                    <option key={rating.value} value={rating.value}>
                      {rating.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="mb-4">
            <label htmlFor="maxTvRating" className="text-label">
              {intl.formatMessage(messages.maxtvrating)}
            </label>
            <div className="form-input-area">
              <div className="form-input-field">
                <select
                  id="maxTvRating"
                  value={currentMaxTvRating || ''}
                  onChange={(e) =>
                    setCurrentMaxTvRating(e.target.value || undefined)
                  }
                >
                  {TV_RATINGS.map((rating) => (
                    <option key={rating.value} value={rating.value}>
                      {rating.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="blockUnrated"
              checked={currentBlockUnrated}
              onChange={(e) => setCurrentBlockUnrated(e.target.checked)}
              className="rounded-md"
            />
            <label htmlFor="blockUnrated">
              {intl.formatMessage(messages.blockunrated)}
            </label>
          </div>
          <div className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="blockAdult"
              checked={currentBlockAdult}
              onChange={(e) => setCurrentBlockAdult(e.target.checked)}
              className="rounded-md"
            />
            <label htmlFor="blockAdult">
              {intl.formatMessage(messages.blockadult)}
            </label>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default BulkEditModal;
