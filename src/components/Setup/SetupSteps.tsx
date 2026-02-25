import { CheckIcon } from '@heroicons/react/24/solid';

interface CurrentStep {
  stepNumber: number;
  description: string;
  active?: boolean;
  completed?: boolean;
  isLastStep?: boolean;
}

const SetupSteps = ({
  stepNumber,
  description,
  active = false,
  completed = false,
  isLastStep = false,
}: CurrentStep) => {
  return (
    <li className="relative md:flex md:flex-1">
      <div className="flex items-center space-x-4 px-6 py-4 text-sm leading-5 font-medium">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center border-2 ${
            active ? 'border-indigo-600' : 'border-white'
          } ${completed ? 'border-indigo-600 bg-indigo-600' : ''} rounded-full`}
        >
          {completed && <CheckIcon className="h-6 w-6 text-white" />}
          {!completed && (
            <p className={active ? 'text-white' : 'text-indigo-200'}>
              {stepNumber}
            </p>
          )}
        </div>
        <p
          className={`text-sm leading-5 font-medium ${
            active ? 'text-white' : 'text-indigo-200'
          }`}
        >
          {description}
        </p>
      </div>

      {!isLastStep && (
        <div className="absolute top-0 right-0 hidden h-full w-5 md:block">
          <svg
            className="h-full w-full text-gray-600"
            viewBox="0 0 22 80"
            fill="none"
            preserveAspectRatio="none"
          >
            <path
              d="M0 -2L20 40L0 82"
              vectorEffect="non-scaling-stroke"
              stroke="currentcolor"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </li>
  );
};

export default SetupSteps;
