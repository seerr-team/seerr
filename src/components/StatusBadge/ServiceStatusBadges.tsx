import StatusBadge, { getStatusLabel } from '@app/components/StatusBadge';
import defineMessages from '@app/utils/defineMessages';
import { getServiceStatusItems } from '@app/utils/serviceRequestStatus';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type MediaServiceStatus from '@server/entity/MediaServiceStatus';
import type { ServiceCommonServer } from '@server/interfaces/api/serviceInterfaces';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.StatusBadge.ServiceStatusBadges', {
  statusinservice: '{status} in {label}',
});

interface ServiceStatusBadgesProps {
  serviceStatuses?: MediaServiceStatus[];
  requests?: MediaRequest[];
  mediaType: 'movie' | 'tv';
  plexUrl?: string;
  tmdbId?: number;
  title?: string | string[];
  seasonNumber?: number;
}

const ServiceStatusBadges = ({
  serviceStatuses,
  requests,
  mediaType,
  plexUrl,
  tmdbId,
  title,
  seasonNumber,
}: ServiceStatusBadgesProps) => {
  const intl = useIntl();
  const { data: services } = useSWR<ServiceCommonServer[]>(
    serviceStatuses?.length ||
      (requests ?? []).some((request) => request.isServiceRequest)
      ? `/api/v1/service/${mediaType === 'movie' ? 'radarr' : 'sonarr'}`
      : null
  );

  const items = getServiceStatusItems({
    services,
    serviceStatuses,
    requests,
    seasonNumber,
  });

  if (!items.length) return null;

  return (
    <>
      {items.map(({ server, status, downloadItem }) => (
        <StatusBadge
          key={`service-badge-${server.id}`}
          status={status}
          downloadItem={downloadItem}
          inProgress={downloadItem.length > 0}
          title={title}
          statusLabelOverride={intl.formatMessage(messages.statusinservice, {
            status: getStatusLabel(intl, status, downloadItem.length > 0),
            label: server.buttonLabel ?? server.name,
          })}
          mediaType={mediaType}
          plexUrl={plexUrl}
          tmdbId={tmdbId}
        />
      ))}
    </>
  );
};

export default ServiceStatusBadges;
