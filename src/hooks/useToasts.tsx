import Toast from '@app/components/Toast';
import { useCallback } from 'react';
import { toast } from 'react-hot-toast';

interface ToastOptions {
  appearance?: 'success' | 'error' | 'info' | 'warning';
  autoDismiss?: boolean;
}

export const useToasts = () => {
  const addToast = useCallback(
    (
      message: React.ReactNode,
      options?: ToastOptions,
      callback?: (id: string) => void
    ) => {
      const id = toast.custom(
        (t) => {
          // Our custom Toast component handles transitionState internally using `t.visible`
          // We will pass appearance from options
          return (
            <Toast
              appearance={options?.appearance || 'info'}
              onDismiss={() => toast.dismiss(t.id)}
              transitionState={t.visible ? 'entered' : 'exiting'}
            >
              {message}
            </Toast>
          );
        },
        {
          duration: options?.autoDismiss !== false ? 4000 : Infinity,
        }
      );

      if (callback) {
        callback(id);
      }
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    toast.dismiss(id);
  }, []);

  return { addToast, removeToast };
};

export default useToasts;
