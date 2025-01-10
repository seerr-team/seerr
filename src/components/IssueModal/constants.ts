import defineMessages from '@app/utils/defineMessages';
import { IssueType } from '@server/constants/issue';
import type { MessageDescriptor } from 'react-intl';

const messages = defineMessages('components.IssueModal', {
  issueAudio: 'Audio',
  issueVideo: 'Video',
  issueSubtitles: 'Subtitle',
  issueLyrics: 'Lyrics',
  issueOther: 'Other',
});

interface IssueOption {
  name: MessageDescriptor;
  issueType: IssueType;
  mediaType?: 'movie' | 'tv' | 'music';
}

export const issueOptions: IssueOption[] = [
  {
    name: messages.issueVideo,
    issueType: IssueType.VIDEO,
  },
  {
    name: messages.issueAudio,
    issueType: IssueType.AUDIO,
  },
  {
    name: messages.issueSubtitles,
    issueType: IssueType.SUBTITLES,
  },
  {
    name: messages.issueLyrics,
    issueType: IssueType.LYRICS,
  },
  {
    name: messages.issueOther,
    issueType: IssueType.OTHER,
  },
];

export const getIssueOptionsForMediaType = (
  mediaType: 'movie' | 'tv' | 'music'
): IssueOption[] => {
  let options = [...issueOptions];

  if (mediaType === 'movie' || mediaType === 'tv') {
    options = options.filter((option) => option.issueType !== IssueType.LYRICS);
  }

  if (mediaType === 'music') {
    options = options.filter(
      (option) =>
        ![IssueType.VIDEO, IssueType.SUBTITLES].includes(option.issueType)
    );
  }

  return options;
};
