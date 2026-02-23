import { Switch } from '@headlessui/react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const Toggle = ({ checked, onChange, disabled = false }: ToggleProps) => {
  return (
    <Switch
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full ${
        checked ? 'bg-indigo-600' : 'bg-gray-700'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span className="sr-only">Toggle</span>
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </Switch>
  );
};

export default Toggle;
