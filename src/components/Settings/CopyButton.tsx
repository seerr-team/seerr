import Tooltip from '@app/components/Common/Tooltip';
import { ClipboardDocumentIcon } from '@heroicons/react/24/solid';
import React, { useEffect } from 'react';
import type { Config } from 'react-popper-tooltip';
import { useToasts } from 'react-toast-notifications';
import useClipboard from 'react-use-clipboard';

type CopyButtonProps = {
  textToCopy: string;
  disabled?: boolean;
  toastMessage?: string;

  tooltipContent?: React.ReactNode;
  tooltipConfig?: Partial<Config>;
};

const CopyButton = ({
  textToCopy,
  disabled,
  toastMessage,
  tooltipContent,
  tooltipConfig,
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
      >
        <ClipboardDocumentIcon />
      </button>
    </Tooltip>
  );
};

export default CopyButton;
