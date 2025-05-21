interface ToggleSwitchProps {
  isToggled?: boolean;
  onToggle: () => void;
  disabled?: unknown;
  highContrast?: boolean;
}

function ToggleSwitch({
  isToggled,
  onToggle,
  disabled,
  highContrast,
}: ToggleSwitchProps) {
  return (
    <span
      role="checkbox"
      tabIndex={0}
      aria-checked={isToggled}
      onClick={() => {
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Space') {
          onToggle();
        }
      }}
      className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center pt-2 focus:outline-none ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <span
        aria-hidden="true"
        className={`${
          isToggled
            ? 'bg-indigo-500'
            : highContrast
            ? 'bg-gray-700'
            : 'bg-gray-800'
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
