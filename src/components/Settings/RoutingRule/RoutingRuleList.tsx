import Button from '@app/components/Common/Button';
import Modal from '@app/components/Common/Modal';
import RoutingRuleRow from '@app/components/Settings/RoutingRule/RoutingRuleRow';
import type { RoutingRule } from '@app/components/Settings/RoutingRule/types';
import type { DVRTestResponse } from '@app/components/Settings/SettingsServices';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PlusIcon,
} from '@heroicons/react/24/solid';
import type { TmdbGenre } from '@server/api/themoviedb/interfaces';
import type { User } from '@server/entity/User';
import type {
  Language,
  RadarrSettings,
  SonarrSettings,
} from '@server/lib/settings';
import type { Keyword } from '@server/models/common';
import axios from 'axios';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

type FilterType = 'all' | 'sonarr' | 'radarr';
type ServiceType = 'radarr' | 'sonarr';

const messages = defineMessages('components.Settings.RoutingRuleList', {
  routingRules: 'Routing Rules',
  routingRulesDescription:
    'Rules are evaluated top-to-bottom. The first matching rule determines where the request is sent. Drag to reorder priority.',
  routingRulesConditionLogic:
    'Conditions use AND logic between fields (all must match) and OR logic within a field (any value can match).',
  addRule: 'Add Rule',
  all: 'All',
  sonarr: 'Sonarr',
  radarr: 'Radarr',
  howRoutingWorks: 'How routing works:',
  routingExplainer:
    'When a request comes in, rules are checked from top to bottom. The first rule whose conditions all match will determine which instance and settings are used. Fallback rules (no conditions) catch everything that did not match above.',
  noFallbackWarning:
    'No fallback rule configured for {serviceType}. Requests that do not match any rule will fail.',
  deleteConfirm: 'Are you sure you want to delete this routing rule?',
  deleteRule: 'Delete Routing Rule',
  animeRuleSuggestion:
    'Want anime to use different settings? Add an anime routing rule.',
  addAnimeRule: 'Add Anime Rule',
});

interface RoutingRuleListProps {
  rules: RoutingRule[];
  radarrServices: RadarrSettings[];
  sonarrServices: SonarrSettings[];
  onAddRule: (prefillData?: Partial<RoutingRule>) => void;
  onEditRule: (rule: RoutingRule) => void;
  revalidate: () => void;
}

const isFallbackRule = (r: RoutingRule) => !!r.isFallback;

const hasFallback = (
  rules: RoutingRule[],
  serviceType: ServiceType,
  is4k: boolean
) =>
  rules.some(
    (r) => r.serviceType === serviceType && !!r.isFallback && !!r.is4k === is4k
  );

function getDefaultInstance(
  serviceType: ServiceType,
  is4k: boolean,
  radarrServices: RadarrSettings[],
  sonarrServices: SonarrSettings[]
) {
  const services = serviceType === 'radarr' ? radarrServices : sonarrServices;
  return services.find((s) => !!s.isDefault && !!s.is4k === is4k);
}

const RoutingRuleList = ({
  rules,
  radarrServices,
  sonarrServices,
  onAddRule,
  onEditRule,
  revalidate,
}: RoutingRuleListProps) => {
  const intl = useIntl();
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    rule: RoutingRule | null;
  }>({ open: false, rule: null });
  const [users, setUsers] = useState<User[]>([]);
  const [keywordsData, setKeywordsData] = useState<Keyword[]>([]);
  const [testResponses, setTestResponses] = useState<
    (DVRTestResponse & { type: string; id: number })[]
  >([]);
  const [localOrder, setLocalOrder] = useState<RoutingRule[] | null>(null);

  const { data: languages } = useSWR<Language[]>('/api/v1/languages');
  const { data: genres } = useSWR<TmdbGenre[]>('/api/v1/genres/movie');

  const radarrDefaultNon4k = useMemo(
    () => getDefaultInstance('radarr', false, radarrServices, sonarrServices),
    [radarrServices, sonarrServices]
  );
  const radarrDefault4k = useMemo(
    () => getDefaultInstance('radarr', true, radarrServices, sonarrServices),
    [radarrServices, sonarrServices]
  );
  const sonarrDefaultNon4k = useMemo(
    () => getDefaultInstance('sonarr', false, radarrServices, sonarrServices),
    [radarrServices, sonarrServices]
  );
  const sonarrDefault4k = useMemo(
    () => getDefaultInstance('sonarr', true, radarrServices, sonarrServices),
    [radarrServices, sonarrServices]
  );

  const missingFallbacks = useMemo(
    () => ({
      radarrNon4k: !!radarrDefaultNon4k && !hasFallback(rules, 'radarr', false),
      radarr4k: !!radarrDefault4k && !hasFallback(rules, 'radarr', true),
      sonarrNon4k: !!sonarrDefaultNon4k && !hasFallback(rules, 'sonarr', false),
      sonarr4k: !!sonarrDefault4k && !hasFallback(rules, 'sonarr', true),
    }),
    [
      rules,
      radarrDefaultNon4k,
      radarrDefault4k,
      sonarrDefaultNon4k,
      sonarrDefault4k,
    ]
  );

  const getServiceInfos = useCallback(async () => {
    const results: (DVRTestResponse & { type: string; id: number })[] = [];
    const allServices = [
      ...radarrServices.map((s) => ({ ...s, _type: 'radarr' as const })),
      ...sonarrServices.map((s) => ({ ...s, _type: 'sonarr' as const })),
    ];

    for (const service of allServices) {
      try {
        const response = await axios.post<DVRTestResponse>(
          `/api/v1/settings/${service._type}/test`,
          {
            hostname: service.hostname,
            apiKey: service.apiKey,
            port: Number(service.port),
            baseUrl: service.baseUrl,
            useSsl: service.useSsl,
          }
        );
        results.push({
          type: service._type,
          id: service.id,
          ...response.data,
        });
      } catch {
        results.push({
          type: service._type,
          id: service.id,
          profiles: [],
          rootFolders: [],
          tags: [],
        });
      }
    }
    setTestResponses(results);
  }, [radarrServices, sonarrServices]);

  useEffect(() => {
    getServiceInfos();
  }, [getServiceInfos]);

  useEffect(() => {
    (async () => {
      const allKeywordIds = rules
        .map((rule) => rule.keywords?.split(','))
        .flat()
        .filter((id): id is string => !!id);

      if (allKeywordIds.length > 0) {
        const keywordResults = await Promise.all(
          [...new Set(allKeywordIds)].map(async (id) => {
            try {
              const response = await axios.get<Keyword | null>(
                `/api/v1/keyword/${id}`
              );
              return response.data;
            } catch {
              return null;
            }
          })
        );
        setKeywordsData(keywordResults.filter((k): k is Keyword => k !== null));
      }

      const allUserIds = rules
        .map((rule) => rule.users)
        .filter((u): u is string => !!u)
        .join(',');

      if (allUserIds) {
        try {
          const response = await axios.get(
            `/api/v1/user?includeIds=${encodeURIComponent(allUserIds)}`
          );
          setUsers(response.data.results);
        } catch {
          // ignore
        }
      }
    })();
  }, [rules]);

  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => {
      const aFallback = isFallbackRule(a);
      const bFallback = isFallbackRule(b);

      if (aFallback && !bFallback) return 1;
      if (!aFallback && bFallback) return -1;

      if (aFallback && bFallback) {
        const a4k = !!a.is4k;
        const b4k = !!b.is4k;
        if (a4k !== b4k) return a4k ? 1 : -1;
        return 0;
      }

      return b.priority - a.priority;
    });
  }, [rules]);

  const filteredRules = useMemo(
    () =>
      sortedRules.filter((r) => filter === 'all' || r.serviceType === filter),
    [sortedRules, filter]
  );

  const displayRules = localOrder ?? filteredRules;

  const counts = {
    all: rules.length,
    sonarr: rules.filter((r) => r.serviceType === 'sonarr').length,
    radarr: rules.filter((r) => r.serviceType === 'radarr').length,
  };

  const openMissingFallbackIfAny = () => {
    const pickForService = (svc: ServiceType) => {
      if (svc === 'radarr') {
        if (missingFallbacks.radarrNon4k && radarrDefaultNon4k) {
          return {
            serviceType: 'radarr' as const,
            is4k: false,
            instance: radarrDefaultNon4k,
          };
        }
        if (missingFallbacks.radarr4k && radarrDefault4k) {
          return {
            serviceType: 'radarr' as const,
            is4k: true,
            instance: radarrDefault4k,
          };
        }
      } else {
        if (missingFallbacks.sonarrNon4k && sonarrDefaultNon4k) {
          return {
            serviceType: 'sonarr' as const,
            is4k: false,
            instance: sonarrDefaultNon4k,
          };
        }
        if (missingFallbacks.sonarr4k && sonarrDefault4k) {
          return {
            serviceType: 'sonarr' as const,
            is4k: true,
            instance: sonarrDefault4k,
          };
        }
      }
      return null;
    };

    let target: {
      serviceType: ServiceType;
      is4k: boolean;
      instance: RadarrSettings | SonarrSettings;
    } | null = null;

    if (filter === 'radarr') target = pickForService('radarr');
    else if (filter === 'sonarr') target = pickForService('sonarr');
    else {
      target = pickForService('radarr') ?? pickForService('sonarr');
    }

    if (!target) return false;

    onAddRule({
      name: `${target.instance.name} Default Route`,
      serviceType: target.serviceType,
      is4k: target.is4k,
      targetServiceId: target.instance.id,
      isFallback: true,
    });

    return true;
  };

  const missingAnimeRule = useMemo(() => {
    const hasSonarrFallback = (is4k: boolean) =>
      rules.some(
        (r) => r.serviceType === 'sonarr' && r.isFallback && !!r.is4k === is4k
      );
    const hasAnimeRule = (is4k: boolean) =>
      rules.some(
        (r) =>
          r.serviceType === 'sonarr' &&
          !!r.is4k === is4k &&
          r.keywords?.includes('210024')
      );

    return {
      non4k: hasSonarrFallback(false) && !hasAnimeRule(false),
      is4k: hasSonarrFallback(true) && !hasAnimeRule(true),
    };
  }, [rules]);

  const handleAddRuleClick = () => {
    if (openMissingFallbackIfAny()) return;
    onAddRule();
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
    setLocalOrder([...filteredRules]);
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    index: number
  ) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index || !localOrder) return;
    if (
      isFallbackRule(localOrder[index]) ||
      isFallbackRule(localOrder[dragIndex])
    ) {
      return;
    }

    const reordered = [...localOrder];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    setLocalOrder(reordered);
    setDragIndex(index);
  };

  const handleDragEnd = async () => {
    if (localOrder) {
      const nonFallbackIds = localOrder
        .filter((r) => !isFallbackRule(r))
        .map((r) => r.id);

      try {
        await axios.post('/api/v1/routingRule/reorder', {
          ruleIds: nonFallbackIds,
        });
        revalidate();
      } catch {
        revalidate();
      }
    }
    setDragIndex(null);
    setLocalOrder(null);
  };

  const handleDelete = async (rule: RoutingRule) => {
    setDeleteModal({ open: true, rule });
  };

  const confirmDelete = async () => {
    if (!deleteModal.rule) return;
    try {
      await axios.delete(`/api/v1/routingRule/${deleteModal.rule.id}`);
      revalidate();
      if (expandedId === deleteModal.rule.id) {
        setExpandedId(null);
      }
    } catch {
      // ignore
    } finally {
      setDeleteModal({ open: false, rule: null });
    }
  };

  return (
    <div>
      <Transition
        as={Fragment}
        show={deleteModal.open}
        enter="transition-opacity ease-in-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity ease-in-out duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <Modal
          title={intl.formatMessage(messages.deleteRule)}
          okText={intl.formatMessage(globalMessages.delete)}
          okButtonType="danger"
          onOk={() => confirmDelete()}
          onCancel={() => setDeleteModal({ open: false, rule: null })}
        >
          {intl.formatMessage(messages.deleteConfirm)}
        </Modal>
      </Transition>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="heading">
              {intl.formatMessage(messages.routingRules)}
            </h3>
          </div>
          <Button
            buttonType="ghost"
            disabled={
              radarrServices.length === 0 && sonarrServices.length === 0
            }
            onClick={handleAddRuleClick}
          >
            <PlusIcon />
            <span>{intl.formatMessage(messages.addRule)}</span>
          </Button>
        </div>
        <p className="description">
          {intl.formatMessage(messages.routingRulesDescription)}
        </p>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg bg-gray-800 p-1 ring-1 ring-gray-700">
        {(
          [
            { key: 'all', label: messages.all },
            { key: 'sonarr', label: messages.sonarr },
            { key: 'radarr', label: messages.radarr },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              filter === tab.key
                ? 'bg-gray-700 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {intl.formatMessage(tab.label)}
            <span
              className={`ml-1.5 ${
                filter === tab.key ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {sonarrDefaultNon4k && missingFallbacks.sonarrNon4k && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-yellow-900/20 px-4 py-2 ring-1 ring-yellow-700/50">
          <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
          <span className="text-sm text-yellow-200">
            {intl.formatMessage(messages.noFallbackWarning, {
              serviceType: 'Sonarr',
            })}
          </span>
        </div>
      )}
      {sonarrDefault4k && missingFallbacks.sonarr4k && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-yellow-900/20 px-4 py-2 ring-1 ring-yellow-700/50">
          <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
          <span className="text-sm text-yellow-200">
            {intl.formatMessage(messages.noFallbackWarning, {
              serviceType: 'Sonarr (4K)',
            })}
          </span>
        </div>
      )}

      {missingAnimeRule.non4k && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-blue-900/20 px-4 py-2 ring-1 ring-blue-700/50">
          <div className="flex items-center gap-2">
            <InformationCircleIcon className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-blue-200">
              {intl.formatMessage(messages.animeRuleSuggestion)}
            </span>
          </div>
          <Button
            buttonType="ghost"
            className="text-xs"
            onClick={() => {
              const sonarrFallback = rules.find(
                (r) => r.serviceType === 'sonarr' && r.isFallback && !r.is4k
              );
              onAddRule({
                name: 'Anime',
                serviceType: 'sonarr',
                is4k: false,
                targetServiceId: sonarrFallback?.targetServiceId,
                keywords: '210024',
                seriesType: 'anime',
              });
            }}
          >
            {intl.formatMessage(messages.addAnimeRule)}
          </Button>
        </div>
      )}

      {radarrDefaultNon4k && missingFallbacks.radarrNon4k && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-yellow-900/20 px-4 py-2 ring-1 ring-yellow-700/50">
          <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
          <span className="text-sm text-yellow-200">
            {intl.formatMessage(messages.noFallbackWarning, {
              serviceType: 'Radarr',
            })}
          </span>
        </div>
      )}
      {radarrDefault4k && missingFallbacks.radarr4k && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-yellow-900/20 px-4 py-2 ring-1 ring-yellow-700/50">
          <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
          <span className="text-sm text-yellow-200">
            {intl.formatMessage(messages.noFallbackWarning, {
              serviceType: 'Radarr (4K)',
            })}
          </span>
        </div>
      )}

      <div className="space-y-2">
        {displayRules.map((rule, index) => (
          <div
            key={rule.id}
            draggable={!isFallbackRule(rule)}
            onDragStart={() => handleDragStart(index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
          >
            <RoutingRuleRow
              rule={rule}
              index={index}
              expanded={expandedId === rule.id}
              isDragging={dragIndex === index}
              onToggle={() =>
                setExpandedId(expandedId === rule.id ? null : rule.id)
              }
              onEdit={() => onEditRule(rule)}
              onDelete={() => handleDelete(rule)}
              dragHandleProps={{}}
              users={users}
              genres={genres}
              languages={languages}
              keywords={keywordsData}
              radarrServices={radarrServices}
              sonarrServices={sonarrServices}
              testResponses={testResponses}
            />
          </div>
        ))}
      </div>

      {filteredRules.length > 0 && (
        <div className="mt-4 rounded-lg bg-gray-800 p-4 ring-1 ring-gray-700">
          <div className="flex gap-3">
            <InformationCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
            <div className="text-xs leading-relaxed text-gray-500">
              <span className="font-medium text-gray-400">
                {intl.formatMessage(messages.howRoutingWorks)}
              </span>{' '}
              {intl.formatMessage(messages.routingExplainer)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoutingRuleList;
