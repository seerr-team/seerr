import defineMessages from '@app/utils/defineMessages';
import type { ServiceCommonServer } from '@server/interfaces/api/serviceInterfaces';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.RequestServicesEdit', {
  title: 'Request Services',
  description:
    'Control which services this user can submit requests to. With no service selected, the user only sees the default request button.',
  allServices: 'All Services',
  allServicesDescription:
    'Grant permission to request from every configured service. Selecting this automatically enables all individual services below.',
  radarrService: 'Request in {name} (Movies)',
  sonarrService: 'Request in {name} (Series)',
  serviceDescription:
    'Grant permission to submit requests to the {name} service.',
  noServices:
    'No services have a request button label configured. Set a "Request Button Label" on a Radarr or Sonarr server to expose it here.',
});

interface RequestServicesEditProps {
  value: string[];
  onChange: (services: string[]) => void;
}

const RequestServicesEdit = ({ value, onChange }: RequestServicesEditProps) => {
  const intl = useIntl();
  const { data: radarrServices } = useSWR<ServiceCommonServer[]>(
    '/api/v1/service/radarr'
  );
  const { data: sonarrServices } = useSWR<ServiceCommonServer[]>(
    '/api/v1/service/sonarr'
  );

  const services: { id: string; name: string; isMovie: boolean }[] = [
    ...(radarrServices ?? [])
      .filter((s) => s.buttonLabel)
      .map((s) => ({
        id: `radarr:${s.id}`,
        name: s.buttonLabel as string,
        isMovie: true,
      })),
    ...(sonarrServices ?? [])
      .filter((s) => s.buttonLabel)
      .map((s) => ({
        id: `sonarr:${s.id}`,
        name: s.buttonLabel as string,
        isMovie: false,
      })),
  ];

  const allIds = services.map((s) => s.id);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => value.includes(id));

  const toggleAll = () => {
    if (allSelected) {
      onChange(value.filter((id) => !allIds.includes(id)));
    } else {
      onChange([...new Set([...value, ...allIds])]);
    }
  };

  const toggleService = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <div className="mt-10">
      <div className="mb-4">
        <h3 className="heading">{intl.formatMessage(messages.title)}</h3>
        <p className="description">
          {intl.formatMessage(messages.description)}
        </p>
      </div>

      {services.length === 0 ? (
        <p className="text-sm text-gray-400">
          {intl.formatMessage(messages.noServices)}
        </p>
      ) : (
        <div className="max-w-3xl">
          <div className="relative flex items-start">
            <div className="flex h-6 items-center">
              <input
                id="request-services-all"
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
              />
            </div>
            <div className="ml-3 text-sm leading-6">
              <label
                htmlFor="request-services-all"
                className="block cursor-pointer"
              >
                <span className="font-medium text-white">
                  {intl.formatMessage(messages.allServices)}
                </span>
                <p className="mt-1 font-normal text-gray-400">
                  {intl.formatMessage(messages.allServicesDescription)}
                </p>
              </label>
            </div>
          </div>

          {services.map((service) => {
            const checked = allSelected || value.includes(service.id);
            return (
              <div key={service.id} className="mt-4 pl-10">
                <div
                  className={`relative flex items-start ${
                    allSelected ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex h-6 items-center">
                    <input
                      id={`request-service-${service.id}`}
                      type="checkbox"
                      disabled={allSelected}
                      checked={checked}
                      onChange={() => toggleService(service.id)}
                    />
                  </div>
                  <div className="ml-3 text-sm leading-6">
                    <label
                      htmlFor={`request-service-${service.id}`}
                      className="flex flex-col"
                    >
                      <span className="font-medium text-white">
                        {intl.formatMessage(
                          service.isMovie
                            ? messages.radarrService
                            : messages.sonarrService,
                          { name: service.name }
                        )}
                      </span>
                      <span className="font-normal text-gray-400">
                        {intl.formatMessage(messages.serviceDescription, {
                          name: service.name,
                        })}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RequestServicesEdit;
