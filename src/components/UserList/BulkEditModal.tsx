import Modal from '@app/components/Common/Modal';
import PermissionEdit from '@app/components/PermissionEdit';
import type { User } from '@app/hooks/useUser';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import {
  getMovieRatingOptions,
  getTvRatingOptions,
} from '@server/constants/contentRatings';
import { hasPermission } from '@server/lib/permissions';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';

interface ParentalControlsData {
  maxMovieRating?: string;
  maxTvRating?: string;
  blockUnrated?: boolean;
  blockAdult?: boolean;
}

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
  blockunrated: 'Block Unrated Content',
  blockadult: 'Block Adult Content',
  mixedvalues: 'Varies across selected users',
  enabledforsome: 'Enabled for some but not all users',
});

/** Compute a common value from an array, or undefined if values differ */
function commonValue<T>(values: T[]): T | undefined {
  if (values.length === 0) return undefined;
  const first = values[0];
  return values.every((v) => v === first) ? first : undefined;
}

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
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Track whether selected users have mixed parental control values
  const [mixedMovieRating, setMixedMovieRating] = useState(false);
  const [mixedTvRating, setMixedTvRating] = useState(false);
  const [mixedBlockUnrated, setMixedBlockUnrated] = useState(false);
  const [mixedBlockAdult, setMixedBlockAdult] = useState(false);

  const blockUnratedRef = useRef<HTMLInputElement>(null);
  const blockAdultRef = useRef<HTMLInputElement>(null);

  const markTouched = (field: string) =>
    setTouchedFields((prev) => new Set(prev).add(field));

  useEffect(() => {
    if (onSaving) {
      onSaving(isSaving);
    }
  }, [isSaving, onSaving]);

  // Fetch parental controls for selected users and compute common/mixed state
  const fetchParentalControls = useCallback(async () => {
    if (!selectedUserIds.length) return;

    try {
      const results = await Promise.allSettled(
        selectedUserIds.map((id) =>
          axios.get<ParentalControlsData>(
            `/api/v1/user/${id}/settings/parental-controls`
          )
        )
      );

      const settings: ParentalControlsData[] = results
        .filter((r) => r.status === 'fulfilled')
        .map(
          (r) =>
            (r as PromiseFulfilledResult<{ data: ParentalControlsData }>).value
              .data
        );

      if (settings.length === 0) return;

      const movieRatings = settings.map((s) => s.maxMovieRating || '');
      const tvRatings = settings.map((s) => s.maxTvRating || '');
      const blockUnrateds = settings.map((s) => s.blockUnrated ?? false);
      const blockAdults = settings.map((s) => s.blockAdult ?? false);

      const commonMovie = commonValue(movieRatings);
      const commonTv = commonValue(tvRatings);
      const commonUnrated = commonValue(blockUnrateds);
      const commonAdult = commonValue(blockAdults);

      if (commonMovie !== undefined) {
        setCurrentMaxMovieRating(commonMovie || undefined);
      } else {
        setMixedMovieRating(true);
      }

      if (commonTv !== undefined) {
        setCurrentMaxTvRating(commonTv || undefined);
      } else {
        setMixedTvRating(true);
      }

      if (commonUnrated !== undefined) {
        setCurrentBlockUnrated(commonUnrated);
      } else {
        setMixedBlockUnrated(true);
      }

      if (commonAdult !== undefined) {
        setCurrentBlockAdult(commonAdult);
      } else {
        setMixedBlockAdult(true);
      }
    } catch {
      // Silently fail — controls start at defaults
    }
  }, [selectedUserIds]);

  useEffect(() => {
    fetchParentalControls();
  }, [fetchParentalControls]);

  // Set indeterminate state on checkbox refs when mixed
  useEffect(() => {
    if (blockUnratedRef.current) {
      blockUnratedRef.current.indeterminate =
        mixedBlockUnrated && !touchedFields.has('blockUnrated');
    }
  }, [mixedBlockUnrated, touchedFields]);

  useEffect(() => {
    if (blockAdultRef.current) {
      blockAdultRef.current.indeterminate =
        mixedBlockAdult && !touchedFields.has('blockAdult');
    }
  }, [mixedBlockAdult, touchedFields]);

  const updateUsers = async () => {
    try {
      setIsSaving(true);
      const { data: updated } = await axios.put<User[]>(`/api/v1/user`, {
        ids: selectedUserIds,
        permissions: currentPermission,
        ...(touchedFields.has('maxMovieRating')
          ? { maxMovieRating: currentMaxMovieRating || '' }
          : {}),
        ...(touchedFields.has('maxTvRating')
          ? { maxTvRating: currentMaxTvRating || '' }
          : {}),
        ...(touchedFields.has('blockUnrated')
          ? { blockUnrated: currentBlockUnrated }
          : {}),
        ...(touchedFields.has('blockAdult')
          ? { blockAdult: currentBlockAdult }
          : {}),
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

  const showMixedMovieHint =
    mixedMovieRating && !touchedFields.has('maxMovieRating');
  const showMixedTvHint = mixedTvRating && !touchedFields.has('maxTvRating');
  const showMixedUnratedHint =
    mixedBlockUnrated && !touchedFields.has('blockUnrated');
  const showMixedAdultHint =
    mixedBlockAdult && !touchedFields.has('blockAdult');

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
                  onChange={(e) => {
                    markTouched('maxMovieRating');
                    setCurrentMaxMovieRating(e.target.value || undefined);
                  }}
                >
                  {getMovieRatingOptions().map((rating) => (
                    <option key={rating.value} value={rating.value}>
                      {rating.label}
                    </option>
                  ))}
                </select>
              </div>
              {showMixedMovieHint && (
                <p className="mt-1 text-sm text-gray-400">
                  {intl.formatMessage(messages.mixedvalues)}
                </p>
              )}
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
                  onChange={(e) => {
                    markTouched('maxTvRating');
                    setCurrentMaxTvRating(e.target.value || undefined);
                  }}
                >
                  {getTvRatingOptions().map((rating) => (
                    <option key={rating.value} value={rating.value}>
                      {rating.label}
                    </option>
                  ))}
                </select>
              </div>
              {showMixedTvHint && (
                <p className="mt-1 text-sm text-gray-400">
                  {intl.formatMessage(messages.mixedvalues)}
                </p>
              )}
            </div>
          </div>
          <div className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="blockUnrated"
              ref={blockUnratedRef}
              checked={currentBlockUnrated}
              onChange={(e) => {
                markTouched('blockUnrated');
                setCurrentBlockUnrated(e.target.checked);
              }}
              className="rounded-md"
            />
            <label htmlFor="blockUnrated">
              {intl.formatMessage(messages.blockunrated)}
            </label>
            {showMixedUnratedHint && (
              <span className="text-xs text-gray-400">
                ({intl.formatMessage(messages.enabledforsome)})
              </span>
            )}
          </div>
          <div className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="blockAdult"
              ref={blockAdultRef}
              checked={currentBlockAdult}
              onChange={(e) => {
                markTouched('blockAdult');
                setCurrentBlockAdult(e.target.checked);
              }}
              className="rounded-md"
            />
            <label htmlFor="blockAdult">
              {intl.formatMessage(messages.blockadult)}
            </label>
            {showMixedAdultHint && (
              <span className="text-xs text-gray-400">
                ({intl.formatMessage(messages.enabledforsome)})
              </span>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default BulkEditModal;
