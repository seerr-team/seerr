import { TagIcon } from '@heroicons/react/24/outline';
import React, { type JSX } from 'react';

type TagProps = {
  children: React.ReactNode;
  iconSvg?: JSX.Element;
};

const Tag = ({ children, iconSvg }: TagProps) => {
  return (
    <div className="inline-flex cursor-pointer items-center rounded-full bg-gray-800 px-2 py-1 text-sm leading-snug text-gray-200 ring-1 ring-inset ring-gray-600 transition hover:bg-gray-700">
      {iconSvg ? (
        React.cloneElement(iconSvg, {
          className: 'mr-1 h-4 w-4',
        })
      ) : (
        <TagIcon className="mr-1 h-4 w-4" />
      )}
      <span>{children}</span>
    </div>
  );
};

export default Tag;
