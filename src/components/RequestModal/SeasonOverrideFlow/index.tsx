import SearchByNameModal from '@app/components/RequestModal/SearchByNameModal';
import SeasonOverrideModal from '@app/components/RequestModal/SeasonOverrideModal';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.RequestModal.SeasonOverrideFlow', {
  confirmseries: 'Confirm Series',
});

interface SeasonOverrideFlowProps {
  show: boolean;
  requestId: number;
  tmdbId: number;
  seasonNumbers: number[];
  subTitle: string;
  backdrop?: string;
  onComplete: () => void;
  onCancel: () => void;
}

const SeasonOverrideFlow = ({
  show,
  requestId,
  tmdbId,
  seasonNumbers,
  subTitle,
  backdrop,
  onComplete,
  onCancel,
}: SeasonOverrideFlowProps) => {
  const intl = useIntl();
  const [tvdbId, setTvdbId] = useState<number | undefined>(undefined);

  // the flow stays mounted for the exit transition, so drop the confirmed
  // series on the way out or reopening would skip straight to the seasons
  const cancel = () => {
    setTvdbId(undefined);
    onCancel();
  };

  const complete = () => {
    setTvdbId(undefined);
    onComplete();
  };

  return (
    <Transition
      as="div"
      enter="transition-opacity duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
      show={show}
    >
      {tvdbId === undefined ? (
        // picking a result only calls setTvdbId, which swaps in the picker
        <SearchByNameModal
          tvdbId={tvdbId}
          setTvdbId={setTvdbId}
          closeModal={cancel}
          onCancel={cancel}
          modalTitle={intl.formatMessage(messages.confirmseries)}
          modalSubTitle={subTitle}
          tmdbId={tmdbId}
          backdrop={backdrop}
        />
      ) : (
        <SeasonOverrideModal
          requestId={requestId}
          tvdbId={tvdbId}
          seasonNumbers={seasonNumbers}
          onComplete={complete}
          onCancel={cancel}
        />
      )}
    </Transition>
  );
};

export default SeasonOverrideFlow;
