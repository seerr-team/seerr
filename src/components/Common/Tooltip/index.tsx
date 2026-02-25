import React from 'react';
import ReactDOM from 'react-dom';
import type { Config } from 'react-popper-tooltip';
import { usePopperTooltip } from 'react-popper-tooltip';

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactElement;
  tooltipConfig?: Partial<Config>;
  className?: string;
};

const Tooltip = ({
  children,
  content,
  tooltipConfig,
  className,
}: TooltipProps) => {
  const { getTooltipProps, setTooltipRef, setTriggerRef, visible } =
    usePopperTooltip({
      followCursor: true,
      offset: [-28, 6],
      placement: 'auto-end',
      ...tooltipConfig,
    });

  const tooltipStyle = [
    'z-50 text-sm absolute font-normal bg-gray-800 px-2 py-1 rounded-sm border border-gray-600 shadow-sm text-gray-100',
  ];

  if (className) {
    tooltipStyle.push(className);
  }

  return (
    <>
      {React.cloneElement(children, { ref: setTriggerRef })}
      {visible &&
        content &&
        ReactDOM.createPortal(
          <div
            ref={setTooltipRef}
            {...getTooltipProps({
              className: tooltipStyle.join(' '),
            })}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
};

export default Tooltip;
