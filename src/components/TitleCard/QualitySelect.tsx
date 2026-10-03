import Button from '@app/components/Common/Button';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Menu, Transition } from '@headlessui/react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Fragment, useEffect } from 'react';
import { useIntl } from 'react-intl';

interface QualitySelectProps {
  label: string;
  onSelect: (is4k: boolean) => void;
  onSelectBoth: () => void;
  onOpenChange?: (open: boolean) => void;
}

const messages = defineMessages('components.TitleCard', {
  requestquality: 'Request Quality',
  both: 'Both',
});

const rowStyle =
  'flex h-8 w-full items-center justify-between rounded-md px-2.5 text-xs font-semibold';

const OpenReporter = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  return null;
};

const QualitySelect = ({
  label,
  onSelect,
  onSelectBoth,
  onOpenChange,
}: QualitySelectProps) => {
  const intl = useIntl();

  return (
    <Menu as="div" className="relative w-full md:hidden">
      {({ open }) => (
        <>
          <OpenReporter open={open} onOpenChange={onOpenChange} />
          <Menu.Button
            as={Button}
            buttonType="primary"
            buttonSize="sm"
            className="h-7 w-full"
          >
            <ArrowDownTrayIcon />
            <span>{label}</span>
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Menu.Items className="absolute bottom-full left-0 right-0 z-50 mb-2 flex origin-bottom flex-col gap-1 rounded-lg border border-gray-700 bg-gray-800 p-1.5 shadow-lg focus:outline-none">
              <div className="px-0.5 text-[9px] uppercase tracking-widest text-gray-400">
                {intl.formatMessage(messages.requestquality)}
              </div>
              <Menu.Item>
                <button
                  type="button"
                  className={`${rowStyle} border border-indigo-500 bg-indigo-600/80 text-white hover:bg-indigo-600`}
                  onClick={() => onSelect(false)}
                >
                  <span>{intl.formatMessage(globalMessages.request)}</span>
                </button>
              </Menu.Item>
              <Menu.Item>
                <button
                  type="button"
                  className={`${rowStyle} border border-gray-600 bg-gray-700/60 text-white hover:bg-gray-700`}
                  onClick={() => onSelect(true)}
                >
                  <span>{intl.formatMessage(globalMessages.request4k)}</span>
                </button>
              </Menu.Item>
              <Menu.Item>
                <button
                  type="button"
                  className="flex h-7 items-center justify-center rounded-md border border-dashed border-gray-600 text-[11px] text-gray-300 hover:border-gray-500 hover:text-white"
                  onClick={() => onSelectBoth()}
                >
                  {intl.formatMessage(messages.both)}
                </button>
              </Menu.Item>
            </Menu.Items>
          </Transition>
        </>
      )}
    </Menu>
  );
};

export default QualitySelect;
