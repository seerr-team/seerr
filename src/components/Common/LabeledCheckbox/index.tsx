import { Field } from 'formik';
import { twMerge } from 'tailwind-merge';

interface LabeledCheckboxProps {
  id: string;
  className?: string;
  label: string;
  description: string;
  onChange: () => void;
  children?: React.ReactNode;
}

const LabeledCheckbox: React.FC<LabeledCheckboxProps> = ({
  id,
  className,
  label,
  description,
  onChange,
  children,
}) => {
  return (
    <>
      <div className={twMerge('relative flex items-start', className)}>
        <div className="flex h-6 items-center">
          <Field type="checkbox" id={id} name={id} onChange={onChange} />
        </div>
        <div className="ml-3 text-sm leading-6">
          <label htmlFor="localLogin" className="block" aria-label={label}>
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
