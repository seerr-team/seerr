import { useState, type JSX } from 'react';
import AnimateHeight from 'react-animate-height';

export interface AccordionProps {
  children: (args: AccordionChildProps) => JSX.Element;
  /** If true, only one accordion item can be open at any time */
  single?: boolean;
  /** If true, at least one accordion item will always be open */
  atLeastOne?: boolean;
  initialOpenIndexes?: number[];
}
export interface AccordionChildProps {
  openIndexes: number[];
  handleClick(index: number): void;
  AccordionContent: typeof AccordionContent;
}

type AccordionContentProps = {
  isOpen: boolean;
  children: React.ReactNode;
};

export const AccordionContent = ({
  isOpen,
  children,
}: AccordionContentProps) => {
  return <AnimateHeight height={isOpen ? 'auto' : 0}>{children}</AnimateHeight>;
};

const Accordion = ({
  single,
  atLeastOne,
  initialOpenIndexes,
  children,
}: AccordionProps) => {
  const initialState = initialOpenIndexes || (atLeastOne && [0]) || [];
  const [openIndexes, setOpenIndexes] = useState<number[]>(initialState);

  const close = (index: number) => {
    const openCount = openIndexes.length;
    const newListOfIndexes =
      atLeastOne && openCount === 1 && openIndexes.includes(index)
        ? openIndexes
        : openIndexes.filter((i) => i !== index);

    setOpenIndexes(newListOfIndexes);
  };

  const open = (index: number) => {
    const newListOfIndexes = single ? [index] : [...openIndexes, index];
    setOpenIndexes(newListOfIndexes);
  };

  const handleItemClick = (index: number) => {
    const action = openIndexes.includes(index) ? 'closing' : 'opening';

    if (action === 'closing') {
      close(index);
    } else {
      open(index);
    }
  };

  return children({
    openIndexes: openIndexes,
    handleClick: handleItemClick,
    AccordionContent,
  });
};

export default Accordion;
