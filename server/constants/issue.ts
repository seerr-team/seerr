export enum IssueType {
  VIDEO = 1,
  AUDIO = 2,
  SUBTITLES = 3,
  LYRICS = 4,
  OTHER = 5,
}

export enum IssueStatus {
  OPEN = 1,
  RESOLVED = 2,
}

export const IssueTypeName = {
  [IssueType.AUDIO]: 'Audio',
  [IssueType.VIDEO]: 'Video',
  [IssueType.SUBTITLES]: 'Subtitle',
  [IssueType.LYRICS]: 'Lyrics',
  [IssueType.OTHER]: 'Other',
};
