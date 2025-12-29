import type { ActivityAnnouncement, AllSettings } from '@server/lib/settings';

const migrationDashboardSettings = async (
  settings: any
): Promise<AllSettings> => {
  if (
    Array.isArray(settings.migrations) &&
    settings.migrations.includes('0008_migrate_dashboard_settings')
  ) {
    return settings;
  }

  settings.activity = settings.activity ?? {};
  settings.main = settings.main ?? {};

  const main = settings.main as Record<string, unknown>;
  const activity = settings.activity as Record<string, unknown>;

  const setIfMissingString = (activityKey: string, mainKey: string) => {
    const current = activity[activityKey];
    const incoming = main[mainKey];

    if (
      (typeof current !== 'string' || !current.trim()) &&
      typeof incoming === 'string' &&
      incoming.trim()
    ) {
      activity[activityKey] = incoming;
    }
  };

  setIfMissingString('heroTagline', 'heroTagline');
  setIfMissingString('heroTitle', 'heroTitle');
  setIfMissingString('heroBody', 'heroBody');
  setIfMissingString('feedbackWebhookUrl', 'feedbackWebhookUrl');

  if (
    typeof activity.announcementEnabled !== 'boolean' &&
    typeof main.announcementEnabled === 'boolean'
  ) {
    activity.announcementEnabled = main.announcementEnabled;
  }

  const currentAnnouncements = activity.announcements;
  const mainAnnouncements = main.announcements;

  if (!Array.isArray(currentAnnouncements) || !currentAnnouncements.length) {
    if (Array.isArray(mainAnnouncements) && mainAnnouncements.length) {
      activity.announcements = mainAnnouncements as ActivityAnnouncement[];
    } else {
      const legacyBody = main.announcementBody;
      if (typeof legacyBody === 'string' && legacyBody.trim()) {
        const legacyTitle =
          typeof main.announcementTitle === 'string'
            ? main.announcementTitle
            : '';

        activity.announcements = [
          {
            id: 'legacy',
            title: legacyTitle,
            body: legacyBody,
          },
        ] satisfies ActivityAnnouncement[];
      }
    }
  }

  if (!Array.isArray(settings.migrations)) {
    settings.migrations = [];
  }
  settings.migrations.push('0008_migrate_dashboard_settings');

  return settings;
};

export default migrationDashboardSettings;
