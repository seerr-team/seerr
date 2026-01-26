import { withProperties } from '@app/utils/typeHelpers';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/solid';
import {
  Fragment,
  useRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
} from 'react';

interface DropdownItemProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  buttonType?: 'primary' | 'ghost';
}

const DropdownItem = ({
  children,
  buttonType = 'primary',
  ...props
}: DropdownItemProps) => {
  return (
    <Menu.Item>
      <a
        className={[
          'button-md my-1 flex cursor-pointer items-center rounded px-4 py-2 text-sm leading-5 text-white focus:text-white focus:outline-none',
          buttonType === 'ghost'
            ? 'bg-transparent from-indigo-600 to-purple-600 hover:bg-gradient-to-br focus:border-gray-500'
            : 'bg-indigo-600 hover:bg-indigo-500 focus:border-indigo-700',
        ].join(' ')}
        {...props}
      >
        {children}
      </a>
    </Menu.Item>
  );
};

type DropdownItemsProps = HTMLAttributes<HTMLDivElement> & {
  dropdownType: 'primary' | 'ghost';
};

const DropdownItems = ({
  children,
  className,
  dropdownType,
  ...props
}: DropdownItemsProps) => {
  return (
    <Transition
      as={Fragment}
      enter="transition ease-out duration-100"
      enterFrom="opacity-0 scale-95"
      enterTo="opacity-100 scale-100"
      leave="transition ease-in duration-75"
      leaveFrom="opacity-100 scale-100"
      leaveTo="opacity-0 scale-95"
    >
      <Menu.Items
        className={[
          'absolute right-0 z-40 mt-2 -mr-1 w-56 origin-top-right rounded-md px-1 shadow-lg',
          dropdownType === 'ghost'
            ? 'border border-gray-700 bg-gray-800 bg-opacity-80 backdrop-blur'
            : 'bg-indigo-600',
          className,
        ].join(' ')}
        {...props}
      >
        <div className="py-1">{children}</div>
      </Menu.Items>
    </Transition>
  );
};

interface DropdownProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  text: React.ReactNode;
  dropdownIcon?: React.ReactNode;
  buttonType?: 'primary' | 'ghost';
}

const Dropdown = ({
  text,
  children,
  dropdownIcon,
  className,
  buttonType = 'primary',
  ...props
}: DropdownProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <Menu as="div" className="relative z-10">
      <Menu.Button
        type="button"
        className={[
          'button-md inline-flex h-full items-center space-x-2 rounded-md border px-4 py-2 text-sm font-medium leading-5 text-white transition duration-150 ease-in-out hover:z-20 focus:z-20 focus:outline-none',
          buttonType === 'ghost'
            ? 'border-gray-600 bg-transparent hover:border-gray-200 focus:border-gray-100 active:border-gray-100'
            : 'focus:ring-blue border-indigo-500 bg-indigo-600 bg-opacity-80 hover:border-indigo-500 hover:bg-opacity-100 active:border-indigo-700 active:bg-indigo-700',
          className,
        ].join(' ')}
        ref={buttonRef}
        disabled={!children}
        {...props}
      >
        {text}
        {children && (dropdownIcon ? dropdownIcon : <ChevronDownIcon />)}
      </Menu.Button>
      {children && (
        <DropdownItems dropdownType={buttonType}>{children}</DropdownItems>
      )}
    </Menu>
  );
};
export default withProperties(Dropdown, {
  Item: DropdownItem,
  Items: DropdownItems,
});
