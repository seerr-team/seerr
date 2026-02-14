import { withProperties } from '@app/utils/typeHelpers';

type TBodyProps = {
  children: React.ReactNode;
};

const TBody = ({ children }: TBodyProps) => {
  return (
    <tbody className="divide-y divide-gray-700 bg-gray-800">{children}</tbody>
  );
};

const TH = ({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<'th'>) => {
  const style = [
    'px-4 py-3 bg-gray-500 text-left text-xs leading-4 font-medium text-gray-200 uppercase tracking-wider truncate',
  ];

  if (className) {
    style.push(className);
  }

  return (
    <th className={style.join(' ')} {...props}>
      {children}
    </th>
  );
};

type TDProps = {
  alignText?: 'left' | 'center' | 'right';
  noPadding?: boolean;
};

const TD = ({
  children,
  alignText = 'left',
  noPadding,
  className,
  ...props
}: TDProps & React.ComponentPropsWithoutRef<'td'>) => {
  const style = ['text-sm leading-5 text-white'];

  switch (alignText) {
    case 'left':
      style.push('text-left');
      break;
    case 'center':
      style.push('text-center');
      break;
    case 'right':
      style.push('text-right');
      break;
  }

  if (!noPadding) {
    style.push('px-4 py-4');
  }

  if (className) {
    style.push(className);
  }

  return (
    <td className={style.join(' ')} {...props}>
      {children}
    </td>
  );
};

type TableProps = {
  children: React.ReactNode;
};

const Table = ({ children }: TableProps) => {
  return (
    <div className="flex flex-col">
      <div className="-mx-4 my-2 overflow-x-auto md:mx-0 lg:mx-0">
        <div className="inline-block min-w-full py-2 align-middle">
          <div className="overflow-hidden rounded-lg shadow md:mx-0 lg:mx-0">
            <table className="min-w-full">{children}</table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default withProperties(Table, { TH, TBody, TD });
