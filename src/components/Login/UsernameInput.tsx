import defineMessages from '@app/utils/defineMessages';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import type { FieldProps } from 'formik';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Login', {
  tipUsernameHasTrailingWhitespace: 'The username/email ends with a space',
});

const hasTrailingWhitespace = (value: string): boolean => {
  return /\s$/.test(value);
};

const UsernameInput = ({ field, form: { touched }, ...props }: FieldProps) => {
  const intl = useIntl();
  return (
    <div>
      <input type="text" {...field} {...props} />
      {touched[field.name] && hasTrailingWhitespace(field.value) ? (
        <div className="warning label-tip flex items-center">
          <ExclamationTriangleIcon className="mr-1 h-4 w-4" />
          {intl.formatMessage(messages.tipUsernameHasTrailingWhitespace)}
        </div>
      ) : null}
    </div>
  );
};

export default UsernameInput;
