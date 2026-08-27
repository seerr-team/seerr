import Button from '@app/components/Common/Button';
import useClickOutside from '@app/hooks/useClickOutside';
import { forwardRef, useRef, useState } from 'react';

interface ConfirmButtonProps {
  onClick: () => void;
  confirmText: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

const ConfirmButton = forwardRef<HTMLButtonElement, ConfirmButtonProps>(
  ({ onClick, children, confirmText, className, disabled }, parentRef) => {
    const ref = useRef(null);
    useClickOutside(ref, () => setIsClicked(false));
    const [isClicked, setIsClicked] = useState(false);
    return (
      <Button
        ref={parentRef}
        buttonType="danger"
        className={`relative overflow-hidden ${className}`}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();

          if (!isClicked) {
            setIsClicked(true);
          } else {
            onClick();
          }
        }}
      >
        <div
          ref={ref}
          className={`relative inset-0 flex h-full w-full transform-gpu items-center justify-center transition duration-300 ${
            isClicked
              ? '-translate-y-full opacity-0'
              : 'translate-y-0 opacity-100'
          }`}
        >
          {children}
        </div>
        <div
          ref={ref}
          className={`absolute inset-0 flex h-full w-full transform-gpu items-center justify-center transition duration-300 ${
            isClicked
              ? 'translate-y-0 opacity-100'
              : 'translate-y-full opacity-0'
          }`}
        >
          {confirmText}
        </div>
      </Button>
    );
  }
);

ConfirmButton.displayName = 'ConfirmButton';

export default ConfirmButton;
