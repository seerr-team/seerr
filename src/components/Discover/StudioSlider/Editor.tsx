import BrandListEditor from '@app/components/Discover/BrandListEditor';
import {
  defaultDiscoverStudios,
  type DiscoverStudio,
} from '@app/components/Discover/studios';
import defineMessages from '@app/utils/defineMessages';
import { MAX_DISCOVER_STUDIOS } from '@server/constants/discover';

const messages = defineMessages('components.Discover.StudioSlider.Editor', {
  editStudios: 'Displayed studios',
  studioIdPlaceholder: 'TMDB Studio ID',
  addStudio: 'Add',
  resetToDefaultStudios: 'Reset to Default Studios',
  removeStudio: 'Remove {name}',
  moveUp: 'Move {name} up',
  moveDown: 'Move {name} down',
  invalidStudioId: 'Enter a TMDB Studio ID.',
  studioLookupFailed: 'Could not find that studio.',
  studioMissingLogo: '{name} has no logo, so it cannot be added.',
  duplicateStudio: '{name} is already in the list.',
  studioAdded: '{name} has been added to the list.',
  tooManyStudios: 'A studio list can contain at most {max} studios.',
});

interface StudioSliderEditorProps {
  studios: DiscoverStudio[];
  onChange: (studios: DiscoverStudio[]) => void;
}

const StudioSliderEditor = ({ studios, onChange }: StudioSliderEditorProps) => (
  <BrandListEditor
    brands={studios}
    defaultBrands={defaultDiscoverStudios}
    maxBrands={MAX_DISCOVER_STUDIOS}
    lookupUrl="/api/v1/studio"
    testId="discover-studio-editor"
    onChange={onChange}
    messages={{
      title: messages.editStudios,
      idPlaceholder: messages.studioIdPlaceholder,
      add: messages.addStudio,
      resetToDefault: messages.resetToDefaultStudios,
      remove: messages.removeStudio,
      moveUp: messages.moveUp,
      moveDown: messages.moveDown,
      invalidId: messages.invalidStudioId,
      lookupFailed: messages.studioLookupFailed,
      missingLogo: messages.studioMissingLogo,
      duplicate: messages.duplicateStudio,
      added: messages.studioAdded,
      tooMany: messages.tooManyStudios,
    }}
  />
);

export default StudioSliderEditor;
