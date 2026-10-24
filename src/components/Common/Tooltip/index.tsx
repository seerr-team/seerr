import {
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useClientPoint,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
  type Placement,
} from '@floating-ui/react';
import React, { useState } from 'react';
import ReactDOM from 'react-dom';

export interface TooltipConfig {
  placement?: Placement;
  offset?: {
    mainAxis?: number;
    crossAxis?: number;
  };
  followCursor?: boolean;
  followCursorAxis?: 'x' | 'y' | 'both';
}

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactElement<any>;
  tooltipConfig?: TooltipConfig;
  className?: string;
};

const Tooltip = ({
  children,
  content,
  tooltipConfig,
  className,
}: TooltipProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    whileElementsMounted: autoUpdate,
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: tooltipConfig?.placement ?? 'bottom-start',
    middleware: [
      offset({
        mainAxis: tooltipConfig?.offset?.mainAxis ?? 20,
        crossAxis: tooltipConfig?.offset?.crossAxis ?? -8,
      }),
      flip(),
      shift({ crossAxis: false }),
    ],
  });
  // hover for mouse, tap for touch
  const hover = useHover(context, { mouseOnly: true });
  const click = useClick(context, { ignoreMouse: true });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });
  const clientPoint = useClientPoint(context, {
    enabled: tooltipConfig?.followCursor ?? true,
    axis: tooltipConfig?.followCursorAxis ?? 'both',
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    click,
    focus,
    dismiss,
    role,
    clientPoint,
  ]);

  const tooltipStyle = [
    'z-50 text-sm absolute font-normal bg-gray-800 px-2 py-1 rounded border border-gray-600 shadow text-gray-100',
  ];

  if (className) {
    tooltipStyle.push(className);
  }

  return (
    <>
      {React.cloneElement(
        children,
        getReferenceProps({ ...children.props, ref: refs.setReference })
      )}
      {isOpen &&
        content &&
        ReactDOM.createPortal(
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className={tooltipStyle.join(' ')}
            {...getFloatingProps()}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
};

export default Tooltip;
