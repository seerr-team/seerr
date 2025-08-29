interface ToggleSwitchProps {
  isToggled: boolean;
  onToggle: () => void;
  disabled?: unknown;
}

function ToggleSwitch({ isToggled, onToggle, disabled }: ToggleSwitchProps) {
  const onClick = () => {
    if (!disabled) {
      onToggle();
    }
  };

  return (
    <span
      role="checkbox"
      tabIndex={0}
      aria-checked={isToggled}
      onClick={() => onClick()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Space') {
          onClick();
        }
      }}
      className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center justify-center pt-2 focus:outline-none ${
        disabled ? 'cursor-default opacity-50' : 'cursor-pointer'
      }`}
    >
      <span
        aria-hidden="true"
        className={`${
          isToggled ? 'bg-indigo-500' : 'bg-gray-700'
        } absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out`}
      ></span>
      <span
        aria-hidden="true"
        className={`${
          isToggled ? 'translate-x-5' : 'translate-x-0'
        } absolute left-0 inline-block h-5 w-5 rounded-full border border-gray-200 bg-white shadow transition-transform duration-200 ease-in-out group-focus:border-blue-300 group-focus:ring`}
      ></span>
    </span>
  );
}

export default ToggleSwitch;
