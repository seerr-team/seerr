import Button from '@app/components/Common/Button';
import Tooltip from '@app/components/Common/Tooltip';
import globalMessages from '@app/i18n/globalMessages';
import {
  getDiscoverNavigationPath,
  getDiscoverNavigationState,
  markDiscoverNavigationPending,
  type DiscoverNavigationItem,
  type DiscoverNavigationState,
} from '@app/utils/discoverNavigation';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

interface DiscoverNavigationButtonsProps {
  currentItem: DiscoverNavigationItem;
}

const DiscoverNavigationButtons = ({
  currentItem,
}: DiscoverNavigationButtonsProps) => {
  const router = useRouter();
  const intl = useIntl();
  const [navigationState, setNavigationState] =
    useState<DiscoverNavigationState | null>(null);

  useEffect(() => {
    setNavigationState(getDiscoverNavigationState(currentItem));
  }, [currentItem]);

  if (!navigationState?.previous && !navigationState?.next) {
    return null;
  }

  const navigateToItem = (item: DiscoverNavigationItem) => {
    markDiscoverNavigationPending(item);
    router.push(getDiscoverNavigationPath(item));
  };

  const previousItem = navigationState.previous;
  const nextItem = navigationState.next;

  return (
    <>
      {previousItem ? (
        <Tooltip content={intl.formatMessage(globalMessages.previous)}>
          <Button
            buttonType="ghost"
            className="z-40 mr-2"
            buttonSize="md"
            onClick={() => navigateToItem(previousItem)}
          >
            <ChevronLeftIcon />
          </Button>
        </Tooltip>
      ) : null}
      {nextItem ? (
        <Tooltip content={intl.formatMessage(globalMessages.next)}>
          <Button
            buttonType="ghost"
            className="z-40 mr-2"
            buttonSize="md"
            onClick={() => navigateToItem(nextItem)}
          >
            <ChevronRightIcon />
          </Button>
        </Tooltip>
      ) : null}
    </>
  );
};

export default DiscoverNavigationButtons;
