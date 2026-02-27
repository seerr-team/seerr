import Badge from '@app/components/Common/Badge';
import type { RoutingRule } from '@app/components/Settings/RoutingRule/types';
import type { DVRTestResponse } from '@app/components/Settings/SettingsServices';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import {
  ChevronDownIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/solid';
import type { TmdbGenre } from '@server/api/themoviedb/interfaces';
import type { User } from '@server/entity/User';
import type {
  Language,
  RadarrSettings,
  SonarrSettings,
} from '@server/lib/settings';
import type { Keyword } from '@server/models/common';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Settings.RoutingRuleRow', {
  fallback: 'Fallback',
  conditions: 'Conditions',
  routeTo: 'Route To',
  matchesAll: 'Matches all requests',
  instanceDefaults: 'Uses instance defaults',
  instance: 'Instance',
  rootFolder: 'Root Folder',
  qualityProfile: 'Quality Profile',
  minimumAvailability: 'Minimum Availability',
  seriesType: 'Series Type',
  tags: 'Tags',
  users: 'Users',
  genres: 'Genres',
  languages: 'Languages',
  keywords: 'Keywords',
  sonarr: 'Sonarr',
  radarr: 'Radarr',
});

interface RoutingRuleRowProps {
  rule: RoutingRule;
  index: number;
  expanded: boolean;
  isDragging: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  dragHandleProps: Record<string, unknown>;
  users?: User[];
  genres?: TmdbGenre[];
  languages?: Language[];
  keywords?: Keyword[];
  radarrServices: RadarrSettings[];
  sonarrServices: SonarrSettings[];
  testResponses: (DVRTestResponse & { type: string; id: number })[];
}

const ConditionBadges = ({
  rule,
  users,
  genres,
  languages,
  keywords,
}: {
  rule: RoutingRule;
  users?: User[];
  genres?: TmdbGenre[];
  languages?: Language[];
  keywords?: Keyword[];
}) => {
  const intl = useIntl();
  const hasConditions =
    !!rule.users || !!rule.genres || !!rule.languages || !!rule.keywords;

  if (!hasConditions) {
    return (
      <span className="text-sm italic text-gray-500">
        {intl.formatMessage(messages.matchesAll)}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {rule.keywords
        ?.split(',')
        .filter(Boolean)
        .map((keywordId) => {
          const keyword = keywords?.find((k) => k.id === Number(keywordId));
          return (
            <Badge key={`kw-${keywordId}`} badgeType="warning">
              {keyword?.name ?? keywordId}
            </Badge>
          );
        })}

      {rule.genres
        ?.split(',')
        .filter(Boolean)
        .map((genreId) => {
          const genre = genres?.find((g) => g.id === Number(genreId));
          return (
            <Badge key={`g-${genreId}`} badgeType="warning">
              {genre?.name ?? genreId}
            </Badge>
          );
        })}

      {rule.languages
        ?.split('|')
        .filter((l) => l && l !== 'server')
        .map((langCode) => {
          const lang = languages?.find((l) => l.iso_639_1 === langCode);
          const name =
            intl.formatDisplayName(langCode, {
              type: 'language',
              fallback: 'none',
            }) ??
            lang?.english_name ??
            langCode;

          return (
            <Badge key={`l-${langCode}`} badgeType="success">
              {name}
            </Badge>
          );
        })}

      {rule.users
        ?.split(',')
        .filter(Boolean)
        .map((userId) => {
          const user = users?.find((u) => u.id === Number(userId));
          return (
            <Badge key={`u-${userId}`}>{user?.displayName ?? userId}</Badge>
          );
        })}
    </div>
  );
};

const TargetBadges = ({
  rule,
  radarrServices,
  sonarrServices,
  testResponses,
}: {
  rule: RoutingRule;
  radarrServices: RadarrSettings[];
  sonarrServices: SonarrSettings[];
  testResponses: (DVRTestResponse & { type: string; id: number })[];
}) => {
  const intl = useIntl();
  const services =
    rule.serviceType === 'sonarr' ? sonarrServices : radarrServices;
  const targetService = services.find((s) => s.id === rule.targetServiceId);
  const testResponse = testResponses.find(
    (r) => r.id === rule.targetServiceId && r.type === rule.serviceType
  );

  const profileName =
    (rule.activeProfileId != null
      ? testResponse?.profiles.find(
          (p) => p.id === Number(rule.activeProfileId)
        )?.name
      : null) ??
    rule.activeProfileName ??
    null;

  const hasOverrides = Boolean(
    rule.rootFolder ||
    rule.activeProfileId != null ||
    rule.seriesType ||
    rule.tags ||
    (rule.serviceType === 'radarr' && rule.minimumAvailability)
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge badgeType="primary">{targetService?.name ?? 'Unknown'}</Badge>
      {rule.rootFolder && <Badge>{rule.rootFolder}</Badge>}
      {rule.activeProfileId != null && (
        <Badge>{profileName ?? String(rule.activeProfileId)}</Badge>
      )}
      {rule.seriesType && <Badge badgeType="warning">{rule.seriesType}</Badge>}
      {rule.tags?.split(',').map((tagId) => {
        const tag = testResponse?.tags.find((t) => t.id === Number(tagId));
        return <Badge key={`t-${tagId}`}>{tag?.label ?? tagId}</Badge>;
      })}
      {!hasOverrides && (
        <span className="text-xs text-gray-500">
          {intl.formatMessage(messages.instanceDefaults)}
        </span>
      )}
    </div>
  );
};

const DragHandle = (props: Record<string, unknown>) => (
  <div
    {...props}
    className="flex cursor-grab flex-col items-center justify-center gap-[3px] px-3 py-3 text-gray-600 transition-colors hover:text-gray-400 active:cursor-grabbing"
  >
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex gap-[3px]">
        <div className="h-[3px] w-[3px] rounded-full bg-current" />
        <div className="h-[3px] w-[3px] rounded-full bg-current" />
      </div>
    ))}
  </div>
);

const RoutingRuleRow = ({
  rule,
  index,
  expanded,
  isDragging,
  onToggle,
  onEdit,
  onDelete,
  dragHandleProps,
  users,
  genres,
  languages,
  keywords,
  radarrServices,
  sonarrServices,
  testResponses,
}: RoutingRuleRowProps) => {
  const intl = useIntl();

  const isFallback = !!rule.isFallback;
  const services =
    rule.serviceType === 'sonarr' ? sonarrServices : radarrServices;
  const targetService = services.find((s) => s.id === rule.targetServiceId);
  const testResponse = testResponses.find(
    (r) => r.id === rule.targetServiceId && r.type === rule.serviceType
  );

  const profileName =
    (rule.activeProfileId != null
      ? testResponse?.profiles.find(
          (p) => p.id === Number(rule.activeProfileId)
        )?.name
      : null) ??
    rule.activeProfileName ??
    null;

  return (
    <div
      className={`rounded-lg transition-all duration-200 ${
        isDragging
          ? 'scale-[1.01] bg-gray-700 shadow-lg ring-2 ring-indigo-500'
          : expanded
            ? 'bg-gray-800 ring-1 ring-gray-500'
            : 'bg-gray-800 ring-1 ring-gray-700 hover:ring-gray-500'
      }`}
    >
      <div className="flex items-center">
        {!isFallback && <DragHandle {...dragHandleProps} />}
        {isFallback && <div className="w-9" />}

        <button
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 text-left"
        >
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-gray-700 font-mono text-xs text-gray-400">
            {index + 1}
          </span>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="truncate text-sm font-medium text-white">
                {rule.name}
              </span>

              {isFallback && (
                <Badge badgeType="success">
                  {intl.formatMessage(messages.fallback)}
                </Badge>
              )}

              <Badge
                badgeType={rule.serviceType === 'sonarr' ? 'primary' : 'danger'}
              >
                {rule.serviceType === 'sonarr'
                  ? intl.formatMessage(messages.sonarr)
                  : intl.formatMessage(messages.radarr)}
              </Badge>

              {rule.is4k && <Badge badgeType="warning">4K</Badge>}
            </div>

            {!expanded && (
              <div className="flex items-center gap-2 text-xs">
                <ConditionBadges
                  rule={rule}
                  users={users}
                  genres={genres}
                  languages={languages}
                  keywords={keywords}
                />
                <span className="text-gray-600">→</span>
                <TargetBadges
                  rule={rule}
                  radarrServices={radarrServices}
                  sonarrServices={sonarrServices}
                  testResponses={testResponses}
                />
              </div>
            )}
          </div>

          <ChevronDownIcon
            className={`h-4 w-4 flex-shrink-0 text-gray-500 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-700 px-4 pb-4 pl-12">
          <div className="grid grid-cols-2 gap-6 pt-4">
            {/* Conditions */}
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                {intl.formatMessage(messages.conditions)}
              </h4>

              {!rule.users &&
              !rule.genres &&
              !rule.languages &&
              !rule.keywords ? (
                <p className="text-sm italic text-gray-500">
                  {intl.formatMessage(messages.matchesAll)}
                </p>
              ) : (
                <div className="space-y-2">
                  {rule.keywords && (
                    <div className="flex items-start gap-2">
                      <span className="w-20 pt-0.5 text-xs text-gray-500">
                        {intl.formatMessage(messages.keywords)}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {rule.keywords
                          .split(',')
                          .filter(Boolean)
                          .map((keywordId) => {
                            const keyword = keywords?.find(
                              (k) => k.id === Number(keywordId)
                            );
                            return (
                              <Badge key={keywordId} badgeType="warning">
                                {keyword?.name ?? keywordId}
                              </Badge>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {rule.genres && (
                    <div className="flex items-start gap-2">
                      <span className="w-20 pt-0.5 text-xs text-gray-500">
                        {intl.formatMessage(messages.genres)}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {rule.genres
                          .split(',')
                          .filter(Boolean)
                          .map((genreId) => {
                            const genre = genres?.find(
                              (g) => g.id === Number(genreId)
                            );
                            return (
                              <Badge key={genreId} badgeType="warning">
                                {genre?.name ?? genreId}
                              </Badge>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {rule.languages && (
                    <div className="flex items-start gap-2">
                      <span className="w-20 pt-0.5 text-xs text-gray-500">
                        {intl.formatMessage(messages.languages)}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {rule.languages
                          .split('|')
                          .filter((l) => l && l !== 'server')
                          .map((langCode) => {
                            const name =
                              intl.formatDisplayName(langCode, {
                                type: 'language',
                                fallback: 'none',
                              }) ?? langCode;
                            return (
                              <Badge key={langCode} badgeType="success">
                                {name}
                              </Badge>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {rule.users && (
                    <div className="flex items-start gap-2">
                      <span className="w-20 pt-0.5 text-xs text-gray-500">
                        {intl.formatMessage(messages.users)}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {rule.users
                          .split(',')
                          .filter(Boolean)
                          .map((userId) => {
                            const user = users?.find(
                              (u) => u.id === Number(userId)
                            );
                            return (
                              <Badge key={userId}>
                                {user?.displayName ?? userId}
                              </Badge>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                {intl.formatMessage(messages.routeTo)}
              </h4>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-20 text-xs text-gray-500">
                    {intl.formatMessage(messages.instance)}
                  </span>
                  <Badge badgeType="primary">
                    {targetService?.name ?? 'Unknown'}
                  </Badge>
                </div>

                {rule.rootFolder && (
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-xs text-gray-500">
                      {intl.formatMessage(messages.rootFolder)}
                    </span>
                    <span className="font-mono text-xs text-gray-300">
                      {rule.rootFolder}
                    </span>
                  </div>
                )}

                {rule.activeProfileId != null && (
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-xs text-gray-500">
                      {intl.formatMessage(messages.qualityProfile)}
                    </span>
                    <span className="text-xs text-gray-300">
                      {profileName ?? String(rule.activeProfileId)}
                    </span>
                  </div>
                )}

                {rule.serviceType === 'radarr' && rule.minimumAvailability && (
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-xs text-gray-500">
                      {intl.formatMessage(messages.minimumAvailability)}
                    </span>
                    <Badge badgeType="warning">
                      {rule.minimumAvailability}
                    </Badge>
                  </div>
                )}

                {rule.seriesType && (
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-xs text-gray-500">
                      {intl.formatMessage(messages.seriesType)}
                    </span>
                    <Badge badgeType="warning">{rule.seriesType}</Badge>
                  </div>
                )}

                {rule.tags && (
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-xs text-gray-500">
                      {intl.formatMessage(messages.tags)}
                    </span>
                    <div className="flex gap-1">
                      {rule.tags
                        .split(',')
                        .filter(Boolean)
                        .map((tagId) => {
                          const tag = testResponse?.tags.find(
                            (t) => t.id === Number(tagId)
                          );
                          return (
                            <Badge key={tagId}>{tag?.label ?? tagId}</Badge>
                          );
                        })}
                    </div>
                  </div>
                )}

                {!rule.rootFolder &&
                  rule.activeProfileId == null &&
                  !rule.minimumAvailability &&
                  !rule.seriesType &&
                  !rule.tags && (
                    <p className="text-xs italic text-gray-500">
                      {intl.formatMessage(messages.instanceDefaults)}
                    </p>
                  )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex justify-end gap-2 border-t border-gray-700 pt-3">
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 transition duration-150 hover:text-white"
            >
              <PencilIcon className="h-3 w-3" />
              {intl.formatMessage(globalMessages.edit)}
            </button>

            {!isFallback && (
              <button
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-gray-400 transition duration-150 hover:bg-red-900/20 hover:text-red-400"
              >
                <TrashIcon className="h-3 w-3" />
                {intl.formatMessage(globalMessages.delete)}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoutingRuleRow;
