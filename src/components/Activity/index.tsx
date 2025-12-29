import PageTitle from '@app/components/Common/PageTitle';
import {
  useActivityHistory,
  useActivityPopular,
  useActivitySessions,
  useActivityStatus,
} from '@app/hooks/useActivity';
import useSettings from '@app/hooks/useSettings';
import defineMessages from '@app/utils/defineMessages';
import { PauseIcon, PlayIcon } from '@heroicons/react/24/solid';
import type {
  ActivityHistoryResponse,
  ActivityPopularResponse,
  ActivitySessionsResponse,
  ActivityStatusResponse,
  PlaysByDateSeries,
} from '@server/interfaces/api/activityInterfaces';
import axios from 'axios';
import Image from 'next/image';
import { useState, type FormEvent } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Activity', {
  title: 'Dashboard',
});

const StatusCard = ({ status }: { status?: ActivityStatusResponse }) => {
  const online = status?.online;
  const serverName = status?.serverName ?? 'Media Server';
  const version = status?.version;

  return (
    <div className="rounded-lg bg-gray-800/80 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Server Status
          </p>
          <p className="mt-1 text-lg font-semibold text-white">{serverName}</p>
          {version && <p className="text-xs text-gray-400">Plex v{version}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-3 w-3 rounded-full ${
              online ? 'bg-emerald-400' : 'bg-red-500'
            }`}
          />
          <span className="text-sm font-medium text-gray-100">
            {online ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
};

const AnnouncementCard = ({
  title,
  body,
}: {
  title?: string;
  body?: string;
}) => {
  if (!body) {
    return null;
  }

  return (
    <div className="mb-4 rounded-lg border border-indigo-500/40 bg-indigo-900/40 p-4 text-xs text-gray-100 sm:text-sm">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
        Announcement
      </p>
      {title && (
        <h2 className="text-sm font-semibold text-white sm:text-base">
          {title}
        </h2>
      )}
      <p className="mt-1 whitespace-pre-line text-[11px] text-gray-200 sm:text-xs">
        {body}
      </p>
    </div>
  );
};

const QuickstartCard = () => (
  <div className="rounded-lg bg-gray-800/80 p-4 sm:p-5">
    <h2 className="text-sm font-semibold text-white sm:text-base">
      New to Plex?
    </h2>
    <p className="mt-1 text-xs text-gray-300 sm:text-sm">
      Learn how to get Plex set up on your devices so you can start watching.
    </p>
    <a
      href="https://support.plex.tv/"
      target="_blank"
      rel="noreferrer"
      className="mt-3 inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 sm:text-sm"
    >
      Plex Quickstart Guide
    </a>
  </div>
);

const ActivityCard = ({
  mode,
  onModeChange,
  history,
}: {
  mode: 'week' | 'month';
  onModeChange: (m: 'week' | 'month') => void;
  history?: ActivityHistoryResponse;
}) => {
  const plays = history?.playsByDate;
  const categories: string[] = plays?.categories ?? [];
  const allSeries: PlaysByDateSeries[] = plays?.series ?? [];

  if (!categories.length || !allSeries.length) {
    return (
      <div className="rounded-lg bg-gray-800/80 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white sm:text-base">
            Activity
          </h2>
          <div className="inline-flex rounded-full bg-gray-900/60 p-1 text-xs">
            <button
              type="button"
              onClick={() => onModeChange('week')}
              className={`rounded-full px-2 py-0.5 ${
                mode === 'week'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => onModeChange('month')}
              className={`rounded-full px-2 py-0.5 ${
                mode === 'month'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400">No activity data yet.</p>
      </div>
    );
  }

  const filteredSeries =
    allSeries.filter((s) => {
      const n = (s.name || s.label || '').toLowerCase();
      return !n.includes('total');
    }) ?? [];

  const displaySeries = filteredSeries.length ? filteredSeries : allSeries;
  const seriesForTotals = displaySeries;

  const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  type Bar = {
    label: string;
    total: number;
    seriesTotals?: number[];
    globalIdx?: number;
  };

  const bars: Bar[] = [];

  if (mode === 'week') {
    const windowSize = Math.min(categories.length, 7);
    const start = Math.max(categories.length - windowSize, 0);

    const visibleCats = categories.slice(start);

    visibleCats.forEach((dt, localIdx) => {
      const globalIdx = start + localIdx;
      const total = seriesForTotals.reduce(
        (sum, s) => sum + (s.data?.[globalIdx] ?? 0),
        0
      );
      const date = new Date(dt);
      const dayIndex = isNaN(date.getTime()) ? localIdx % 7 : date.getDay();

      bars.push({
        label: daysShort[dayIndex],
        total,
        globalIdx,
      });
    });
  } else {
    const monthBuckets = new Map<
      string,
      { key: string; label: string; seriesTotals: number[]; total: number }
    >();

    for (let i = 0; i < categories.length; i++) {
      const date = new Date(categories[i]);
      if (isNaN(date.getTime())) continue;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        '0'
      )}`;

      let bucket = monthBuckets.get(key);
      if (!bucket) {
        const monthNames = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        const label = `${monthNames[date.getMonth()]} '${String(
          date.getFullYear()
        ).slice(-2)}`;
        bucket = {
          key,
          label,
          seriesTotals: new Array(seriesForTotals.length).fill(0),
          total: 0,
        };
        monthBuckets.set(key, bucket);
      }

      if (!bucket) {
        continue;
      }

      const bucketTotals = bucket;
      seriesForTotals.forEach((s, idx) => {
        const v = s.data?.[i] ?? 0;
        bucketTotals.seriesTotals[idx] += v;
        bucketTotals.total += v;
      });
    }

    const ordered = Array.from(monthBuckets.values()).sort((a, b) =>
      a.key.localeCompare(b.key)
    );
    const last = ordered.slice(-7);

    last.forEach((b) =>
      bars.push({
        label: b.label,
        total: b.total,
        seriesTotals: b.seriesTotals,
      })
    );
  }

  const max = Math.max(...bars.map((b) => b.total), 1);
  const colorForSeries = (idx: number) =>
    idx === 0 ? '#3ccf91' : idx === 1 ? '#3b82f6' : '#8b5cf6';

  const legendSeries = displaySeries;

  return (
    <div className="rounded-lg bg-gray-800/80 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white sm:text-base">
          Activity
        </h2>
        <div className="inline-flex rounded-full bg-gray-900/60 p-1 text-xs">
          <button
            type="button"
            onClick={() => onModeChange('week')}
            className={`rounded-full px-2 py-0.5 ${
              mode === 'week'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => onModeChange('month')}
            className={`rounded-full px-2 py-0.5 ${
              mode === 'month'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>
      <div className="flex h-40 items-end gap-2 sm:h-48">
        {bars.map((bar, idx) => (
          <div
            key={idx}
            className="flex h-full flex-1 flex-col items-center justify-end text-xs"
          >
            <div className="mb-1 text-[10px] text-gray-300">{bar.total}</div>
            <div className="flex h-full w-full flex-col-reverse overflow-hidden rounded-md bg-gray-900">
              {legendSeries.map((_, sIdx) => {
                let v = 0;

                if (mode === 'week' && typeof bar.globalIdx === 'number') {
                  const series = legendSeries[sIdx];
                  v = series?.data?.[bar.globalIdx] ?? 0;
                } else if (
                  mode === 'month' &&
                  bar.seriesTotals &&
                  bar.seriesTotals.length
                ) {
                  v = bar.seriesTotals[sIdx] ?? 0;
                }

                if (!v) return null;

                const height = Math.max((v / max) * 100, 4);

                return (
                  <div
                    key={sIdx}
                    className="w-full"
                    style={{
                      height: `${height}%`,
                      backgroundColor: colorForSeries(sIdx),
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-1 text-[10px] text-gray-400">{bar.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-300">
        {legendSeries.map((s, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: colorForSeries(idx) }}
            />
            <span>{s.name || `Series ${idx + 1}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const NowPlayingCard = ({
  activity,
}: {
  activity?: ActivitySessionsResponse;
}) => {
  const sessions = activity?.sessions ?? [];
  const count = activity?.streamCount ?? sessions.length ?? 0;

  return (
    <div className="rounded-lg bg-gray-800/80 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white sm:text-base">
          Now Playing
        </h2>
        <span className="rounded-full bg-gray-900/60 px-2 py-0.5 text-xs text-gray-300">
          {count} stream{count === 1 ? '' : 's'}
        </span>
      </div>
      {!sessions.length ? (
        <p className="text-xs text-gray-400">Nothing playing right now.</p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s, idx) => (
            <li
              key={idx}
              className="flex items-center gap-3 rounded-md bg-gray-900/70 p-2"
            >
              <div className="relative h-16 w-10 flex-shrink-0 overflow-hidden rounded bg-gray-700">
                {s.thumb && (
                  <Image
                    unoptimized
                    src={s.thumb}
                    alt={s.title}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {s.title}
                </p>
                <p className="text-[11px] text-gray-400">
                  {s.mediaType === 'episode' ? 'TV' : 'Movie'}
                </p>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-gray-700">
                  <div
                    className="h-full rounded bg-indigo-500"
                    style={{ width: `${s.progressPercent ?? 0}%` }}
                  />
                </div>
              </div>
              <div className="text-gray-400">
                {s.state === 'playing' ? (
                  <PlayIcon className="h-4 w-4" />
                ) : (
                  <PauseIcon className="h-4 w-4" />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const PopularCard = ({ popular }: { popular?: ActivityPopularResponse }) => {
  const movies = popular?.movies ?? [];
  const tv = popular?.tv ?? [];
  const hasData = movies.length || tv.length;

  return (
    <div className="rounded-lg bg-gray-800/80 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white sm:text-base">
          Popular This Month
        </h2>
      </div>
      {!hasData ? (
        <p className="text-xs text-gray-400">
          No popular titles yet. Start watching to see trends here.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {movies.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Movies
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
                {movies.slice(0, 6).map((m, idx) => (
                  <div
                    key={idx}
                    className="rounded-md bg-gray-900/60 p-2 text-xs text-gray-200"
                  >
                    <div className="relative mb-2 h-24 w-full overflow-hidden rounded bg-gray-700">
                      {m.thumb && (
                        <Image
                          unoptimized
                          src={m.thumb}
                          alt={m.title}
                          fill
                          sizes="200px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="truncate font-medium text-white">
                      {m.title}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {m.year}{' '}
                      {m.plays
                        ? `• ${m.plays} play${m.plays === 1 ? '' : 's'}`
                        : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tv.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Series
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
                {tv.slice(0, 6).map((t, idx) => (
                  <div
                    key={idx}
                    className="rounded-md bg-gray-900/60 p-2 text-xs text-gray-200"
                  >
                    <div className="relative mb-2 h-24 w-full overflow-hidden rounded bg-gray-700">
                      {t.thumb && (
                        <Image
                          unoptimized
                          src={t.thumb}
                          alt={t.title}
                          fill
                          sizes="200px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="truncate font-medium text-white">
                      {t.title}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {t.year}{' '}
                      {t.plays
                        ? `• ${t.plays} play${t.plays === 1 ? '' : 's'}`
                        : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Activity = () => {
  const intl = useIntl();
  const settings = useSettings();
  const { data: status } = useActivityStatus();
  const { data: sessions } = useActivitySessions();
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const { data: history } = useActivityHistory(mode);
  const { data: popular } = useActivityPopular(
    settings.currentSettings.activityPopularDays
  );

  const [feedbackType, setFeedbackType] = useState<
    'comment' | 'error' | 'collection'
  >('comment');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const bannerUrl = settings.currentSettings.activityBannerUrl?.trim();
  const safeBannerUrl =
    bannerUrl && (bannerUrl.startsWith('/') || /^https?:\/\//i.test(bannerUrl))
      ? bannerUrl
      : null;

  const heroTagline =
    settings.currentSettings.activityHeroTagline ||
    `Welcome to ${settings.currentSettings.applicationTitle}`;
  const heroTitle =
    settings.currentSettings.activityHeroTitle ||
    intl.formatMessage(messages.title);
  const heroBody =
    settings.currentSettings.activityHeroBody ||
    "See what's playing, explore popular picks, and request new movies and shows in one place.";

  const showAnnouncement =
    settings.currentSettings.activityAnnouncementEnabled &&
    settings.currentSettings.activityAnnouncements.length > 0;

  const handleFeedbackSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) {
      setFeedbackError('Please enter a message.');
      return;
    }
    setFeedbackSubmitting(true);
    setFeedbackSuccess(null);
    setFeedbackError(null);

    try {
      await axios.post('/api/v1/dashboard/feedback', {
        type: feedbackType,
        message: feedbackMessage.trim(),
      });

      setFeedbackMessage('');
      setFeedbackSuccess('Thanks! Your feedback has been sent.');
    } catch (err: unknown) {
      let message = 'Failed to send feedback.';
      if (axios.isAxiosError(err)) {
        const data = err.response?.data;
        if (data && typeof data === 'object') {
          const maybeMessage = (data as Record<string, unknown>).message;
          if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
            message = maybeMessage;
          }
        }
      }
      setFeedbackError(message);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.title)} />
      <div className="pb-4 pt-2">
        <div
          className="relative mb-6 h-32 w-full overflow-hidden rounded-xl bg-gray-900 sm:h-40"
          style={
            safeBannerUrl
              ? {
                  backgroundImage: `url(${safeBannerUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-gray-900/90 via-gray-900/40 to-transparent" />
          <div className="absolute inset-y-0 left-0 flex items-center px-5 sm:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                {heroTagline}
              </p>
              <h1 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                {heroTitle}
              </h1>
              <p className="mt-2 max-w-md text-xs text-gray-200 sm:text-sm">
                {heroBody}
              </p>
            </div>
          </div>
        </div>
        {showAnnouncement &&
          settings.currentSettings.activityAnnouncements
            .slice(0, 3)
            .map((a) => (
              <AnnouncementCard key={a.id} title={a.title} body={a.body} />
            ))}
      </div>
      <div className="space-y-6 pb-6">
        <StatusCard status={status} />
        <NowPlayingCard activity={sessions} />
        <PopularCard popular={popular} />
        <ActivityCard mode={mode} onModeChange={setMode} history={history} />
        <QuickstartCard />
        {settings.currentSettings.activityFeedbackEnabled && (
          <div className="rounded-lg bg-gray-800/80 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white sm:text-base">
              Thoughts, issues, or ideas?
            </h2>
            <p className="mt-1 text-xs text-gray-300 sm:text-sm">
              Leave a quick note to report errors, share comments, or suggest
              new collections.
            </p>
            <form onSubmit={handleFeedbackSubmit} className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2 text-[11px] text-gray-200">
                <button
                  type="button"
                  className={`rounded-full px-2 py-0.5 ${
                    feedbackType === 'comment'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-200'
                  }`}
                  onClick={() => setFeedbackType('comment')}
                >
                  Comment
                </button>
                <button
                  type="button"
                  className={`rounded-full px-2 py-0.5 ${
                    feedbackType === 'error'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-200'
                  }`}
                  onClick={() => setFeedbackType('error')}
                >
                  Report error
                </button>
                <button
                  type="button"
                  className={`rounded-full px-2 py-0.5 ${
                    feedbackType === 'collection'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-200'
                  }`}
                  onClick={() => setFeedbackType('collection')}
                >
                  Collection idea
                </button>
              </div>
              <div>
                <textarea
                  className="w-full rounded-md border border-gray-700 bg-gray-900/70 p-2 text-xs text-gray-100 focus:border-indigo-500 focus:outline-none sm:text-sm"
                  rows={3}
                  placeholder="Share your thoughts here…"
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                />
              </div>
              {feedbackError && (
                <p className="text-[11px] text-red-400">{feedbackError}</p>
              )}
              {feedbackSuccess && (
                <p className="text-[11px] text-emerald-400">
                  {feedbackSuccess}
                </p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={feedbackSubmitting}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-50 sm:text-sm"
                >
                  {feedbackSubmitting ? 'Sending…' : 'Send feedback'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
};

export default Activity;
