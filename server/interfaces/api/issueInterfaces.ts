import type { IssueType } from '@server/constants/issue';
import type Issue from '@server/entity/Issue';
import type { PaginatedResponse } from './common';

export interface IssueResultsResponse extends PaginatedResponse {
  results: Issue[];
}

export type IssueRequestBody = {
  message: string;
  mediaId: number;
  issueType: IssueType;
  problemSeason?: number;
  problemEpisode?: number;
  userId?: number;
};
