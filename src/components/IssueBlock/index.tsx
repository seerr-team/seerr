import Button from '@app/components/Common/Button';
import { issueOptions } from '@app/components/IssueModal/constants';
import { useUser } from '@app/hooks/useUser';
import {
  CalendarIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  UserIcon,
} from '@heroicons/react/24/solid';
import type Issue from '@server/entity/Issue';
import Link from 'next/link';
import { useIntl } from 'react-intl';

interface IssueBlockProps {
  issue: Issue;
}

const IssueBlock = ({ issue }: IssueBlockProps) => {
  const { user } = useUser();
  const intl = useIntl();
  const issueOption = issueOptions.find(
    (opt) => opt.issueType === issue.issueType
  );

  if (!issueOption) {
    return null;
  }

  return (
    <div className="px-4 py-3 text-gray-300">
      <div className="flex items-center justify-between">
        <div className="mr-6 min-w-0 flex-1 flex-col items-center text-sm leading-5">
          <div className="flex flex-nowrap">
            <ExclamationTriangleIcon className="mr-1.5 h-5 w-5 shrink-0" />
            <span className="w-40 truncate md:w-auto">
              {intl.formatMessage(issueOption.name)}
            </span>
          </div>
          <div className="white mb-1 flex flex-nowrap">
            <UserIcon className="mr-1.5 h-5 w-5 min-w-0 shrink-0" />
            <span className="w-40 truncate md:w-auto">
              <Link
                href={
                  issue.createdBy.id === user?.id
                    ? '/profile'
                    : `/users/${issue.createdBy.id}`
                }
                className="font-semibold text-gray-100 transition duration-300 hover:text-white hover:underline"
              >
                {issue.createdBy.displayName}
              </Link>
            </span>
          </div>
          <div className="white mb-1 flex flex-nowrap">
            <CalendarIcon className="mr-1.5 h-5 w-5 min-w-0 shrink-0" />
            <span className="w-40 truncate md:w-auto">
              {intl.formatDate(issue.createdAt, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
        <div className="ml-2 flex shrink-0 flex-wrap">
          <Link href={`/issues/${issue.id}`} passHref legacyBehavior>
            <Button buttonType="primary" as="a">
              <EyeIcon />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default IssueBlock;
