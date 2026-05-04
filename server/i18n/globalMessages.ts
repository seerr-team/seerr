import { defineMessages } from '@server/i18n';

const globalMessages = defineMessages('notifications.common', {
  requestedBy: 'Requested By',
  requestStatus: 'Request Status',
  pendingApproval: 'Pending Approval',
  processing: 'Processing',
  available: 'Available',
  declined: 'Declined',
  failed: 'Failed',
  commentFrom: 'Comment from {userName}',
  reportedBy: 'Reported By',
  issueType: 'Issue Type',
  issueStatus: 'Issue Status',
  open: 'Open',
  resolved: 'Resolved',
  viewIssue: 'View Issue in {applicationTitle}',
  viewMedia: 'View Media in {applicationTitle}',
  openIn: 'Open in {applicationTitle}',
  movie: 'movie',
  series: 'series',
  issue: 'issue',
  issueTypeName: '{type} issue',
});

export default globalMessages;
