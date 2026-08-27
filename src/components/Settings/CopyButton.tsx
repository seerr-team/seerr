import Tooltip from '@app/components/Common/Tooltip';
import useToasts from '@app/hooks/useToasts';
import { ClipboardDocumentIcon } from '@heroicons/react/24/solid';
import React, { useEffect } from 'react';
import type { Config } from 'react-popper-tooltip';
import useClipboard from 'react-use-clipboard';

type CopyButtonProps = {
  textToCopy: string;
  disabled?: boolean;
  toastMessage?: string;

  tooltipContent?: React.ReactNode;
  tooltipConfig?: Partial<Config>;
  ariaLabel?: string;
};

const CopyButton = ({
  textToCopy,
  disabled,
  toastMessage,
  tooltipContent,
  tooltipConfig,
  ariaLabel,
}: CopyButtonProps) => {
  const [isCopied, setCopied] = useClipboard(textToCopy, {
    successDuration: 1000,
  });
  const { addToast } = useToasts();

  useEffect(() => {
    if (isCopied && toastMessage) {
      addToast(toastMessage, {
        appearance: 'info',
        autoDismiss: true,
      });
    }
  }, [isCopied, addToast, toastMessage]);

  return (
    <Tooltip content={tooltipContent} tooltipConfig={tooltipConfig}>
      <button
        onClick={(e) => {
          e.preventDefault();
          setCopied();
        }}
        className="input-action"
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
      >
        <ClipboardDocumentIcon />
      </button>
    </Tooltip>
  );
};

export default CopyButton;
