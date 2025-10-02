import React from 'react';

export type QuotaMode = 'split' | 'combined';

interface QuotaModeToggleProps {
  value: QuotaMode;
  onChange: (mode: QuotaMode) => void;
  className?: string;
}

const cardClasses = (
  isActive: boolean,
  additional: string | undefined
): string =>
  `${
    additional ?? ''
  } flex cursor-pointer items-center justify-between rounded-md border px-4 py-3 text-sm transition hover:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500 focus:outline-none ${
    isActive
      ? 'border-indigo-500 bg-indigo-500/10 text-white shadow'
      : 'border-gray-700 bg-gray-900 text-gray-200'
  }`.trim();

const radioIndicatorClasses = (isActive: boolean): string =>
  `ml-4 grid h-4 w-4 place-items-center rounded-full border ${
    isActive ? 'border-indigo-300 bg-indigo-500' : 'border-gray-500'
  }`;

const radioDotClasses = (isActive: boolean): string =>
  `h-2 w-2 rounded-full ${isActive ? 'bg-white' : 'bg-transparent'}`;

const QuotaModeToggle: React.FC<QuotaModeToggleProps> = ({
  value,
  onChange,
  className,
}) => {
  return (
    <div className={`grid gap-3 md:grid-cols-2 ${className ?? ''}`}>
      <label className={cardClasses(value === 'split', undefined)}>
        <span>Separate movie and series limits</span>
        <span className={radioIndicatorClasses(value === 'split')}>
          <span className={radioDotClasses(value === 'split')}></span>
        </span>
        <input
          className="sr-only"
          type="radio"
          name="quotaMode"
          value="split"
          checked={value === 'split'}
          onChange={() => onChange('split')}
        />
      </label>
      <label className={cardClasses(value === 'combined', undefined)}>
        <span>Use a combined limit for requests</span>
        <span className={radioIndicatorClasses(value === 'combined')}>
          <span className={radioDotClasses(value === 'combined')}></span>
        </span>
        <input
          className="sr-only"
          type="radio"
          name="quotaMode"
          value="combined"
          checked={value === 'combined'}
          onChange={() => onChange('combined')}
        />
      </label>
    </div>
  );
};

export default QuotaModeToggle;
