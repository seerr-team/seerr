import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/solid';

interface AlertProps {
  title?: React.ReactNode;
  type?: 'warning' | 'info' | 'error';
  children?: React.ReactNode;
}

const Alert = ({ title, children, type }: AlertProps) => {
  let design = {
    bgColor: 'border border-yellow-500 backdrop-blur-sm bg-yellow-400/20',
    titleColor: 'text-yellow-100',
    textColor: 'text-yellow-300',
    svg: <ExclamationTriangleIcon className="h-5 w-5" />,
  };

  switch (type) {
    case 'info':
      design = {
        bgColor: 'border border-indigo-500 backdrop-blur-sm bg-indigo-400/20',
        titleColor: 'text-gray-100',
        textColor: 'text-gray-300',
        svg: <InformationCircleIcon className="h-5 w-5" />,
      };
      break;
    case 'error':
      design = {
        bgColor: 'bg-red-600',
        titleColor: 'text-red-100',
        textColor: 'text-red-300',
        svg: <XCircleIcon className="h-5 w-5" />,
      };
      break;
  }

  return (
    <div className={`mb-4 rounded-md p-4 ${design.bgColor}`}>
      <div className="flex">
        <div className={`flex-shrink-0 ${design.titleColor}`}>{design.svg}</div>
        <div className="ml-3">
          {title && (
            <div className={`text-sm font-medium ${design.titleColor}`}>
              {title}
            </div>
          )}
          {children && (
            <div className={`mt-2 text-sm first:mt-0 ${design.textColor}`}>
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Alert;
