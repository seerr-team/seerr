import { SmallLoadingSpinner } from '@app/components/Common/LoadingSpinner';
import PlexPinEntry from '@app/components/Login/PlexPinEntry';
import defineMessages from '@app/utils/defineMessages';
import { LockClosedIcon } from '@heroicons/react/24/solid';
import type { PlexProfile } from '@server/api/plextv';
import Image from 'next/image';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Login.PlexProfileSelector', {
  profile: 'Profile',
  selectProfile: 'Select Profile',
  selectProfileDescription: 'Select which Plex profile you want to use',
  selectProfileError: 'Failed to select profile',
});

interface PlexProfileSelectorProps {
  profiles: PlexProfile[];
  mainUserId: number;
  authToken: string | undefined;
  onProfileSelected: (
    profileId: string,
    pin?: string,
    onError?: (msg: string) => void
  ) => Promise<void>;
}

const PlexProfileSelector = ({
  profiles,
  onProfileSelected,
}: PlexProfileSelectorProps) => {
  const intl = useIntl();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<PlexProfile | null>(
    null
  );

  const handleProfileClick = (profile: PlexProfile) => {
    setSelectedProfileId(profile.id);
    setSelectedProfile(profile);

    if (profile.protected) {
      setShowPinEntry(true);
    } else {
      setIsSubmitting(true);

      try {
        onProfileSelected(profile.id);
      } catch (err) {
        setError(intl.formatMessage(messages.selectProfileError));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handlePinSubmit = async (pin: string) => {
    if (!selectedProfileId) return;
    await onProfileSelected(selectedProfileId, pin, setPinError);
  };

  const handlePinCancel = () => {
    setShowPinEntry(false);
    setSelectedProfile(null);
    setSelectedProfileId(null);
    setPinError(null);
  };

  if (showPinEntry && selectedProfile && selectedProfileId) {
    return (
      <PlexPinEntry
        profileId={selectedProfileId}
        profileName={
          selectedProfile.title ||
          selectedProfile.username ||
          intl.formatMessage(messages.profile)
        }
        onSubmit={handlePinSubmit}
        onCancel={handlePinCancel}
        error={pinError}
      />
    );
  }

  return (
    <div className="w-full">
      <h2 className="mb-6 text-center text-xl font-bold text-gray-100">
        {intl.formatMessage(messages.selectProfile)}
      </h2>
      <p className="mb-6 text-center text-sm text-gray-300">
        {intl.formatMessage(messages.selectProfileDescription)}
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-red-600 p-3 text-white">
          {intl.formatMessage(messages.selectProfileError)}
        </div>
      )}

      <div className="relative mb-6">
        {isSubmitting && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/50">
            <SmallLoadingSpinner />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => handleProfileClick(profile)}
              disabled={
                isSubmitting ||
                (selectedProfileId === profile.id && !profile.protected)
              }
              className={`relative flex transform flex-col items-center rounded-2xl p-5 transition-all hover:scale-105 hover:shadow-lg ${
                selectedProfileId === profile.id
                  ? 'bg-indigo-600 ring-2 ring-indigo-400'
                  : 'border border-white/20 bg-white/10 backdrop-blur-sm'
              } ${isSubmitting ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <div className="relative mb-4 h-20 w-20 overflow-hidden rounded-full shadow-md ring-2 ring-white/30">
                <Image
                  src={profile.thumb}
                  alt={profile.title || profile.username || 'Profile'}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>

              <span
                className="mb-1 w-full break-words text-center text-base font-semibold text-white"
                title={profile.username || profile.title}
              >
                {profile.username || profile.title}
              </span>

              {profile.protected && (
                <div className="mt-2 text-gray-400">
                  <LockClosedIcon className="h-4 w-4" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlexProfileSelector;
