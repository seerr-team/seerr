import Dropdown from '@app/components/Common/Dropdown';
import { withProperties } from '@app/utils/typeHelpers';
import { Menu } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/solid';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

type ButtonWithDropdownProps = {
  text: React.ReactNode;
  dropdownIcon?: React.ReactNode;
  buttonType?: 'primary' | 'ghost';
} & (
  | ({ as?: 'button' } & ButtonHTMLAttributes<HTMLButtonElement>)
  | ({ as: 'a' } & AnchorHTMLAttributes<HTMLAnchorElement>)
);

const ButtonWithDropdown = ({
  text,
  children,
  dropdownIcon,
  className,
  buttonType = 'primary',
  ...props
}: ButtonWithDropdownProps) => {
  const styleClasses = {
    mainButtonClasses: 'button-md text-white border',
    dropdownSideButtonClasses: 'button-md border',
  };

  switch (buttonType) {
    case 'ghost':
      styleClasses.mainButtonClasses +=
        ' bg-transparent border-gray-600 hover:border-gray-200 focus:border-gray-100 active:border-gray-100';
      styleClasses.dropdownSideButtonClasses = styleClasses.mainButtonClasses;
      break;
    default:
      styleClasses.mainButtonClasses +=
        ' bg-indigo-600/80 border-indigo-500 hover:bg-indigo-600 hover:border-indigo-500 active:bg-indigo-700 active:border-indigo-700 focus:ring-blue';
      styleClasses.dropdownSideButtonClasses +=
        ' bg-indigo-600/80 border-indigo-500 hover:bg-indigo-600 active:bg-indigo-600 focus:ring-blue';
  }

  const TriggerElement = props.as ?? 'button';

  return (
    <Menu as="div" className="relative z-10 inline-flex">
      <TriggerElement
        type="button"
        className={`relative z-10 inline-flex h-full items-center px-4 py-2 text-sm leading-5 font-medium transition duration-150 ease-in-out hover:z-20 focus:z-20 focus:outline-hidden ${
          styleClasses.mainButtonClasses
        } ${children ? 'rounded-l-md' : 'rounded-md'} ${className}`}
        {...(props as Record<string, string>)}
      >
        {text}
      </TriggerElement>
      {children && (
        <span className="relative -ml-px block">
          <Menu.Button
            type="button"
            className={`relative z-10 inline-flex h-full items-center rounded-r-md px-2 py-2 text-sm leading-5 font-medium text-white transition duration-150 ease-in-out hover:z-20 focus:z-20 ${styleClasses.dropdownSideButtonClasses}`}
            aria-label="Expand"
          >
            {dropdownIcon ? dropdownIcon : <ChevronDownIcon />}
          </Menu.Button>
          <Dropdown.Items dropdownType={buttonType}>{children}</Dropdown.Items>
        </span>
      )}
    </Menu>
  );
};
export default withProperties(ButtonWithDropdown, { Item: Dropdown.Item });
