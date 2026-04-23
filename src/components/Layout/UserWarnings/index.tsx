import AddEmailModal from '@app/components/Login/AddEmailModal';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import {
  ChevronRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Layout.UserWarnings', {
  emailRequired: 'An email address is required.',
  emailInvalid: 'Email address is invalid.',
  passwordRequired: 'A password is required.',
  profileIncomplete: 'Profile is incomplete',
});

const UserWarnings: React.FC = () => {
  const intl = useIntl();
  const { user, revalidate } = useUser();
  const [showEmailModal, setShowEmailModal] = useState(false);

  if (!user || !user.warnings || user.warnings.length === 0) {
    return null;
  }

  let warningText = '';
  let showSetEmail = false;

  for (const warning of user.warnings) {
    switch (warning) {
      case 'userEmailRequired':
        warningText = intl.formatMessage(messages.emailRequired);
        showSetEmail = true;
        break;
    }
  }

  if (!warningText) {
    return null;
  }

  return (
    <>
      {showEmailModal && (
        <AddEmailModal
          onClose={() => setShowEmailModal(false)}
          onSave={() => {
            setShowEmailModal(false);
            revalidate();
          }}
        />
      )}
      <button
        onClick={showSetEmail ? () => setShowEmailModal(true) : undefined}
        className="service-error-banner mb-4 w-full cursor-pointer transition duration-300 hover:border-yellow-400 hover:bg-yellow-500/30"
      >
        <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
        <span className="flex-1 text-left">
          <span className="font-bold">
            {intl.formatMessage(messages.profileIncomplete)}
          </span>
          {': '}
          {warningText}
        </span>
        <ChevronRightIcon className="h-5 w-5 flex-shrink-0" />
      </button>
    </>
  );
};

export default UserWarnings;
