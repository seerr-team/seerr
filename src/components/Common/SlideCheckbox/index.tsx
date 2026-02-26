type SlideCheckboxProps = {
  onClick: () => void;
  checked?: boolean;
};

const SlideCheckbox = ({ onClick, checked = false }: SlideCheckboxProps) => {
  return (
    <span
      role="checkbox"
      tabIndex={0}
      aria-checked={false}
      onClick={() => {
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Space') {
          onClick();
        }
      }}
      className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center pt-2 focus:outline-hidden`}
    >
      <span
        aria-hidden="true"
        className={`${
          checked ? 'bg-indigo-500' : 'bg-gray-700'
        } absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out`}
      />
      <span
        aria-hidden="true"
        className={`${
          checked ? 'translate-x-5' : 'translate-x-0'
        } absolute left-0 inline-block h-5 w-5 rounded-full border border-gray-200 bg-white shadow transition-transform duration-200 ease-in-out group-focus:border-blue-300 group-focus:ring-3 group-focus:ring-blue-500`}
      />
    </span>
  );
};

export default SlideCheckbox;
