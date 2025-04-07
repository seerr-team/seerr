import Button, { type ButtonProps } from '@app/components/Common/Button';
import { SmallLoadingSpinner } from '@app/components/Common/LoadingSpinner';
import { type PropsWithChildren } from 'react';
import { twMerge } from 'tailwind-merge';

export type LoginButtonProps = ButtonProps<'button'> &
  PropsWithChildren<{
    loading?: boolean;
  }>;

export default function LoginButton({
  loading,
  className,
  children,
  ...buttonProps
}: LoginButtonProps) {
  return (
    <Button
      className={twMerge(
        'relative flex-grow bg-transparent disabled:opacity-50',
        className
      )}
      disabled={loading}
      {...buttonProps}
    >
      {loading && (
        <div className="absolute right-0 mr-4 h-4 w-4">
          <SmallLoadingSpinner />
        </div>
      )}

      {children}
    </Button>
  );
}
