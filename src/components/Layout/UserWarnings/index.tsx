import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Layout.UserWarnings', {
  emailRequired: 'An email address is required.',
  emailInvalid: 'Email address is invalid.',
  passwordRequired: 'A password is required.',
});

interface UserWarningsProps {
  onClick?: () => void;
}

const UserWarnings: React.FC<UserWarningsProps> = ({ onClick }) => {
  const intl = useIntl();
  const { user } = useUser();

  if (!user || !user.warnings || user.warnings.length === 0) {
    return null;
  }

  let res = null;

  user.warnings.forEach((warning) => {
    let link = '';
    let warningText = '';
    let warningTitle = '';

    switch (warning) {
      case 'userEmailRequired':
        link = '/profile/settings/';
        warningTitle = 'Profile is incomplete';
        warningText = intl.formatMessage(messages.emailRequired);
        break;
      case 'userEmailInvalid':
        link = '/profile/settings/';
        warningTitle = 'Profile needs attention';
        warningText = intl.formatMessage(messages.emailInvalid);
        break;
      case 'userPasswordRequired':
        link = '/profile/settings/';
        warningTitle = 'Security setup incomplete';
        warningText = intl.formatMessage(messages.passwordRequired);
        break;
      default:
        break;
    }

    if (!link) {
      return;
    }

    res = (
      <Link
        href={link}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onClick) {
            onClick();
          }
        }}
        role="button"
        tabIndex={0}
        className="mx-2 mb-2 flex items-center rounded-lg border border-amber-300/30 bg-gradient-to-r from-amber-500/20 to-rose-500/20 p-2 text-xs text-amber-100 ring-1 ring-amber-200/10 transition duration-300 hover:from-amber-400/25 hover:to-rose-400/25"
      >
        <ExclamationTriangleIcon className="h-6 w-6 text-amber-300" />
        <div className="flex min-w-0 flex-1 flex-col truncate px-2 last:pr-0">
          <span className="font-bold text-amber-200">{warningTitle}</span>
          <span className="truncate text-amber-100/90">{warningText}</span>
        </div>
      </Link>
    );
  });

  return res;
};

export default UserWarnings;
