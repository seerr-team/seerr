import Alert from '@app/components/Common/Alert';
import { Transition } from '@headlessui/react';
import React from 'react';

interface LoginErrorProps {
  error: string;
}

const LoginError: React.FC<LoginErrorProps> = ({ error }) => {
  return (
    <Transition
      as="div"
      show={!!error}
      enter="transition-opacity duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <Alert type="error">{error}</Alert>
    </Transition>
  );
};

export default LoginError;
