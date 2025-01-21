import { Field } from 'formik';
import { useId } from 'react';
import { twMerge } from 'tailwind-merge';

interface LabeledCheckboxProps {
  name: string;
  className?: string;
  label: string;
  description: string;
  onChange?: () => void;
  children?: React.ReactNode;
}

const LabeledCheckbox: React.FC<LabeledCheckboxProps> = ({
  name,
  className,
  label,
  description,
  onChange,
  children,
}) => {
  const id = useId();

  return (
    <>
      <div className={twMerge('relative flex items-start', className)}>
        <div className="flex h-6 items-center">
          <Field type="checkbox" id={id} name={name} onChange={onChange} />
        </div>
        <div className="ml-3 text-sm leading-6">
          <label htmlFor={id} className="block">
            <div className="flex flex-col">
              <span className="font-medium text-white">{label}</span>
              <span className="font-normal text-gray-400">{description}</span>
            </div>
          </label>
        </div>
      </div>
      {
        /* can hold child checkboxes */
        children && <div className="mt-4 pl-10">{children}</div>
      }
    </>
  );
};

export default LabeledCheckbox;
