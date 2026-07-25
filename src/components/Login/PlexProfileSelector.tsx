import { SmallLoadingSpinner } from '@app/components/Common/LoadingSpinner';
import globalMessages from '@app/i18n/globalMessages';
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
  onProfileSelected: (profileId: string) => Promise<void>;
  onBack?: () => void;
}

const PlexProfileSelector = ({
  profiles,
  onProfileSelected,
  onBack,
}: PlexProfileSelectorProps) => {
  const intl = useIntl();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProfileClick = async (profile: PlexProfile) => {
    if (isSubmitting) return;

    setSelectedProfileId(profile.id);
    setIsSubmitting(true);
    setError(null);

    try {
      // PIN prompts are handled by the parent from a REQUIRES_PIN response
      await onProfileSelected(profile.id);
    } catch {
      setError(intl.formatMessage(messages.selectProfileError));
      setSelectedProfileId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 flex items-center text-indigo-400 transition-colors hover:text-indigo-200"
        >
          <svg
            className="mr-2 h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {intl.formatMessage(globalMessages.back)}
        </button>
      )}
      <h2 className="mb-6 text-center text-xl font-bold text-gray-100">
        {intl.formatMessage(messages.selectProfile)}
      </h2>
      <p className="mb-6 text-center text-sm text-gray-300">
        {intl.formatMessage(messages.selectProfileDescription)}
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-red-600 p-3 text-white">{error}</div>
      )}

      <div className="relative mb-6">
        {isSubmitting && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/50">
            <SmallLoadingSpinner />
          </div>
        )}

        <div className="grid grid-cols-2 justify-items-center gap-4 sm:grid-cols-3 sm:gap-6 md:gap-8">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => handleProfileClick(profile)}
              disabled={isSubmitting}
              className={`relative flex h-48 w-32 flex-col items-center justify-start rounded-2xl border border-white/20 bg-white/10 p-6 shadow-lg backdrop-blur transition-all hover:ring-2 hover:ring-indigo-400 ${
                selectedProfileId === profile.id
                  ? 'bg-indigo-600 ring-2 ring-indigo-400'
                  : 'border border-white/20 bg-white/10 backdrop-blur-sm'
              } ${isSubmitting ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <div className="relative mx-auto mb-2 flex h-20 w-20 shrink-0 grow-0 items-center justify-center overflow-hidden rounded-full bg-gray-900 shadow ring-2 ring-indigo-400">
                {profile.thumb ? (
                  <Image
                    src={profile.thumb}
                    alt={profile.title || profile.username || 'Profile'}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-700 text-3xl font-bold text-white">
                    {(profile.username || profile.title || '?')[0]}
                  </span>
                )}
              </div>
              <div className="mb-2 flex items-center justify-center gap-2">
                {profile.protected && (
                  <span className="z-10 rounded-full bg-black/80 p-1.5">
                    <LockClosedIcon className="h-4 w-4 text-indigo-400" />
                  </span>
                )}
                {profile.isMainUser && (
                  <span className="z-10 rounded-full bg-black/80 p-1.5">
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4 text-yellow-400"
                    >
                      <path d="M2.166 6.5l3.5 7 4.334-7 4.334 7 3.5-7L17.5 17.5h-15z" />
                    </svg>
                  </span>
                )}
              </div>
              <span
                className="mb-1 w-full break-words text-center text-base font-semibold text-white"
                title={profile.username || profile.title}
              >
                {profile.username || profile.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlexProfileSelector;
