import CreateIssueModal from '@app/components/IssueModal/CreateIssueModal';
import { Transition } from '@headlessui/react';

interface IssueModalProps {
  show?: boolean;
  onCancel: () => void;
  mediaType: 'movie' | 'tv' | 'book';
  mediaId: number;
  issueId?: never;
}

const IssueModal = ({
  show,
  mediaType,
  onCancel,
  mediaId,
}: IssueModalProps) => (
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
    <CreateIssueModal
      mediaType={mediaType}
      onCancel={onCancel}
      mediaId={mediaId}
    />
  </Transition>
);

export default IssueModal;
