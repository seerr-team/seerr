import globalMessages from '@app/i18n/globalMessages';
import { MediaRequestFailureReason, MediaType } from '@server/constants/media';
import type { IntlShape, MessageDescriptor } from 'react-intl';

const failureReasonMessages: Record<
  MediaRequestFailureReason,
  MessageDescriptor
> = {
  [MediaRequestFailureReason.SERVICE_UNREACHABLE]:
    globalMessages.failurereasonunreachable,
  [MediaRequestFailureReason.DISPATCH_FAILED]:
    globalMessages.failurereasondispatch,
  [MediaRequestFailureReason.TVDB_ID_UNRESOLVED]:
    globalMessages.failurereasontvdbid,
  [MediaRequestFailureReason.SEASON_NUMBERING_UNVERIFIED]:
    globalMessages.failurereasonseasonunverified,
  [MediaRequestFailureReason.SEASON_NUMBERING_MISMATCH]:
    globalMessages.failurereasonseasonmismatch,
};

export const formatFailureReason = (
  intl: IntlShape,
  type: MediaType,
  reason?: MediaRequestFailureReason | null
): string | undefined => {
  const message = reason ? failureReasonMessages[reason] : undefined;

  return message
    ? intl.formatMessage(message, {
        serviceName: type === MediaType.MOVIE ? 'Radarr' : 'Sonarr',
      })
    : undefined;
};

export const canSearchAnotherListing = (
  reason?: MediaRequestFailureReason | null
): boolean => reason === MediaRequestFailureReason.SEASON_NUMBERING_MISMATCH;

// a numbering mismatch re-runs the same comparison on every attempt
export const canRetryRequest = (
  reason?: MediaRequestFailureReason | null
): boolean => reason !== MediaRequestFailureReason.SEASON_NUMBERING_MISMATCH;
