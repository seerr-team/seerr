import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import type {
  ActivityAnnouncement,
  ActivitySettings,
} from '@server/lib/settings';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { mutate } from 'swr';
import * as Yup from 'yup';

import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

const messages = defineMessages('components.SettingsActivity', {
  title: 'Dashboard',
  description:
    'Configure the Dashboard page (/dashboard) and its optional announcements + feedback.',
  enabledLabel: 'Enable dashboard',
  enabledDescription: 'Shows live sessions and watch trends (Plex + Tautulli).',
  heroSection: 'Hero',
  heroTaglineLabel: 'Tagline (small text above title)',
  heroTitleLabel: 'Main title',
  heroBodyLabel: 'Subtext',
  announcementSection: 'Announcements',
  announcementEnabledLabel: 'Show announcements on dashboard',
  announcementTitleLabel: 'Title',
  announcementBodyLabel: 'Text',
  addAnnouncement: 'Add announcement',
  removeAnnouncement: 'Remove',
  feedbackSection: 'Viewer Feedback',
  feedbackEnabledLabel: 'Enable feedback form on dashboard',
  webhookLabel: 'Feedback webhook URL (optional)',
  webhookHelp:
    'If set, new feedback submissions will also be sent to this HTTP(S) endpoint (for example, a Discord or Slack webhook).',
  bannerUrlLabel: 'Banner image URL',
  bannerUrlDescription:
    'Optional. Use a path under public/ (ex: /activity-banner.jpg) or an http(s) URL.',
  popularDaysLabel: 'Popular timeframe (days)',
  popularDaysDescription:
    'The number of days to use when calculating popular titles.',
  toastSettingsSuccess: 'Settings saved successfully!',
  toastSettingsFailure: 'Something went wrong while saving settings.',
});

type FeedbackEntry = {
  id: string;
  type: 'comment' | 'error' | 'collection';
  message: string;
  createdAt: string;
  userEmail?: string;
  userName?: string;
};

type ActivitySettingsUpdate = Partial<
  Omit<ActivitySettings, 'bannerUrl' | 'feedbackWebhookUrl'>
> & {
  bannerUrl?: string | null;
  feedbackWebhookUrl?: string | null;
};

const SettingsActivity = () => {
  const intl = useIntl();
  const { addToast } = useToasts();

  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<ActivitySettings>('/api/v1/settings/dashboard');
  const { data: feedback } = useSWR<FeedbackEntry[]>(
    '/api/v1/dashboard/feedback'
  );

  const ActivitySettingsSchema = Yup.object().shape({
    enabled: Yup.boolean().required(),
    bannerUrl: Yup.string()
      .nullable()
      .test(
        'is-valid-banner',
        'Banner URL must start with / or http(s)://',
        (value) => {
          if (!value) return true;
          return (
            value.startsWith('/') || /^https?:\/\//i.test(value.trim() ?? '')
          );
        }
      ),
    popularDays: Yup.number().min(1).max(365).required(),
    heroTagline: Yup.string().max(120),
    heroTitle: Yup.string().max(120),
    heroBody: Yup.string().max(1000),
    feedbackWebhookUrl: Yup.string().url().nullable(),
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.title)}</h3>
        <p className="description">
          {intl.formatMessage(messages.description)}
        </p>
      </div>
      <Formik
        initialValues={{
          enabled: data?.enabled ?? false,
          bannerUrl: data?.bannerUrl ?? '',
          popularDays: data?.popularDays ?? 30,
          heroTagline: data?.heroTagline ?? '',
          heroTitle: data?.heroTitle ?? '',
          heroBody: data?.heroBody ?? '',
          announcementEnabled: data?.announcementEnabled ?? false,
          announcements: (data?.announcements ?? []) as ActivityAnnouncement[],
          feedbackEnabled: data?.feedbackEnabled ?? true,
          feedbackWebhookUrl: data?.feedbackWebhookUrl ?? '',
        }}
        validationSchema={ActivitySettingsSchema}
        enableReinitialize
        onSubmit={async (values) => {
          try {
            const trimmedBannerUrl = values.bannerUrl?.trim() ?? '';
            const trimmedWebhookUrl = values.feedbackWebhookUrl?.trim() ?? '';

            const cleanedAnnouncements: ActivityAnnouncement[] = (
              (values.announcements as ActivityAnnouncement[]) || []
            )
              .filter((a) => a.body && a.body.trim().length > 0)
              .slice(0, 3)
              .map((a) => ({
                ...a,
                id:
                  a.id ||
                  `${Date.now().toString(36)}-${Math.random()
                    .toString(36)
                    .slice(2, 8)}`,
              }));

            const payload: ActivitySettingsUpdate = {
              enabled: values.enabled,
              bannerUrl: trimmedBannerUrl ? trimmedBannerUrl : null,
              popularDays: Number(values.popularDays),
              heroTagline: values.heroTagline ?? '',
              heroTitle: values.heroTitle ?? '',
              heroBody: values.heroBody ?? '',
              announcementEnabled: values.announcementEnabled,
              announcements: cleanedAnnouncements,
              feedbackEnabled: values.feedbackEnabled,
              feedbackWebhookUrl: trimmedWebhookUrl ? trimmedWebhookUrl : null,
            };

            await axios.post('/api/v1/settings/dashboard', payload);

            mutate('/api/v1/settings/public');

            addToast(intl.formatMessage(messages.toastSettingsSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch (e) {
            addToast(intl.formatMessage(messages.toastSettingsFailure), {
              autoDismiss: true,
              appearance: 'error',
            });
          } finally {
            revalidate();
          }
        }}
      >
        {({
          isSubmitting,
          isValid,
          values,
          errors,
          touched,
          setFieldValue,
        }) => {
          return (
            <Form className="section">
              <div className="form-row">
                <label htmlFor="enabled" className="checkbox-label">
                  {intl.formatMessage(messages.enabledLabel)}
                  <span className="label-tip">
                    {intl.formatMessage(messages.enabledDescription)}
                  </span>
                </label>
                <div className="form-input-area">
                  <Field
                    type="checkbox"
                    id="enabled"
                    name="enabled"
                    onChange={() => setFieldValue('enabled', !values.enabled)}
                  />
                </div>
              </div>

              <div className="form-row">
                <h4 className="heading">
                  {intl.formatMessage(messages.heroSection)}
                </h4>
              </div>
              <div className="form-row">
                <label htmlFor="heroTagline" className="text-label">
                  {intl.formatMessage(messages.heroTaglineLabel)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      id="heroTagline"
                      name="heroTagline"
                      type="text"
                      className="rounded-md"
                      autoComplete="off"
                      data-form-type="other"
                      data-1pignore="true"
                      data-lpignore="true"
                      data-bwignore="true"
                    />
                  </div>
                  {errors.heroTagline &&
                    touched.heroTagline &&
                    typeof errors.heroTagline === 'string' && (
                      <div className="error">{errors.heroTagline}</div>
                    )}
                </div>
              </div>

              <div className="form-row">
                <label htmlFor="heroTitle" className="text-label">
                  {intl.formatMessage(messages.heroTitleLabel)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      id="heroTitle"
                      name="heroTitle"
                      type="text"
                      className="rounded-md"
                      autoComplete="off"
                      data-form-type="other"
                      data-1pignore="true"
                      data-lpignore="true"
                      data-bwignore="true"
                    />
                  </div>
                  {errors.heroTitle &&
                    touched.heroTitle &&
                    typeof errors.heroTitle === 'string' && (
                      <div className="error">{errors.heroTitle}</div>
                    )}
                </div>
              </div>

              <div className="form-row">
                <label htmlFor="heroBody" className="text-label">
                  {intl.formatMessage(messages.heroBodyLabel)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      as="textarea"
                      id="heroBody"
                      name="heroBody"
                      rows={3}
                      className="rounded-md"
                    />
                  </div>
                  {errors.heroBody &&
                    touched.heroBody &&
                    typeof errors.heroBody === 'string' && (
                      <div className="error">{errors.heroBody}</div>
                    )}
                </div>
              </div>

              <div className="form-row">
                <label htmlFor="bannerUrl" className="text-label">
                  {intl.formatMessage(messages.bannerUrlLabel)}
                  <span className="label-tip">
                    {intl.formatMessage(messages.bannerUrlDescription)}
                  </span>
                </label>
                <div className="form-input-area">
                  <Field
                    type="text"
                    inputMode="url"
                    id="bannerUrl"
                    name="bannerUrl"
                    className="max-w-2xl"
                    placeholder="/activity-banner.jpg"
                    autoComplete="off"
                    data-form-type="other"
                    data-1pignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                  />
                  {touched.bannerUrl &&
                    errors.bannerUrl &&
                    typeof errors.bannerUrl === 'string' && (
                      <div className="error">{errors.bannerUrl}</div>
                    )}
                </div>
              </div>

              <div className="form-row">
                <label htmlFor="popularDays" className="text-label">
                  {intl.formatMessage(messages.popularDaysLabel)}
                  <span className="label-tip">
                    {intl.formatMessage(messages.popularDaysDescription)}
                  </span>
                </label>
                <div className="form-input-area">
                  <Field
                    type="text"
                    inputMode="numeric"
                    id="popularDays"
                    name="popularDays"
                    className="short"
                    autoComplete="off"
                    data-form-type="other"
                    data-1pignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                  />
                  {touched.popularDays &&
                    errors.popularDays &&
                    typeof errors.popularDays === 'string' && (
                      <div className="error">{errors.popularDays}</div>
                    )}
                </div>
              </div>

              <div className="form-row mt-8">
                <h4 className="heading">
                  {intl.formatMessage(messages.announcementSection)}
                </h4>
              </div>
              <div className="form-row">
                <label htmlFor="announcementEnabled" className="checkbox-label">
                  {intl.formatMessage(messages.announcementEnabledLabel)}
                </label>
                <div className="form-input-area">
                  <Field
                    type="checkbox"
                    id="announcementEnabled"
                    name="announcementEnabled"
                    onChange={() =>
                      setFieldValue(
                        'announcementEnabled',
                        !values.announcementEnabled
                      )
                    }
                  />
                </div>
              </div>
              {(
                values.announcements as ActivityAnnouncement[] | undefined
              )?.map((announcement, index) => (
                <div
                  key={announcement.id || index}
                  className="mb-4 rounded-lg border border-gray-700 p-4"
                >
                  <div className="form-row">
                    <label
                      htmlFor={`announcements.${index}.title`}
                      className="text-label"
                    >
                      {intl.formatMessage(messages.announcementTitleLabel)}
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          id={`announcements.${index}.title`}
                          name={`announcements.${index}.title`}
                          type="text"
                          className="rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="form-row">
                    <label
                      htmlFor={`announcements.${index}.body`}
                      className="text-label"
                    >
                      {intl.formatMessage(messages.announcementBodyLabel)}
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          as="textarea"
                          id={`announcements.${index}.body`}
                          name={`announcements.${index}.body`}
                          rows={3}
                          className="rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button
                      buttonType="default"
                      onClick={(e) => {
                        e.preventDefault();
                        const next =
                          (values.announcements as ActivityAnnouncement[]) ||
                          [];
                        next.splice(index, 1);
                        setFieldValue('announcements', [...next]);
                      }}
                    >
                      {intl.formatMessage(messages.removeAnnouncement)}
                    </Button>
                  </div>
                </div>
              ))}
              <div className="form-row">
                <div className="form-input-area">
                  <Button
                    buttonType="default"
                    disabled={
                      ((values.announcements as ActivityAnnouncement[]) || [])
                        .length >= 3
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      const current =
                        (values.announcements as ActivityAnnouncement[]) || [];
                      if (current.length >= 3) {
                        return;
                      }
                      setFieldValue('announcements', [
                        ...current,
                        {
                          id: `${Date.now().toString(36)}-${Math.random()
                            .toString(36)
                            .slice(2, 8)}`,
                          title: '',
                          body: '',
                        },
                      ]);
                    }}
                  >
                    {intl.formatMessage(messages.addAnnouncement)}
                  </Button>
                </div>
              </div>

              <div className="form-row mt-8">
                <h4 className="heading">
                  {intl.formatMessage(messages.feedbackSection)}
                </h4>
              </div>
              <div className="form-row">
                <label htmlFor="feedbackEnabled" className="checkbox-label">
                  {intl.formatMessage(messages.feedbackEnabledLabel)}
                </label>
                <div className="form-input-area">
                  <Field
                    type="checkbox"
                    id="feedbackEnabled"
                    name="feedbackEnabled"
                    onChange={() =>
                      setFieldValue('feedbackEnabled', !values.feedbackEnabled)
                    }
                  />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="feedbackWebhookUrl" className="text-label">
                  {intl.formatMessage(messages.webhookLabel)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      id="feedbackWebhookUrl"
                      name="feedbackWebhookUrl"
                      type="text"
                      className="rounded-md"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {intl.formatMessage(messages.webhookHelp)}
                  </p>
                  {errors.feedbackWebhookUrl &&
                    touched.feedbackWebhookUrl &&
                    typeof errors.feedbackWebhookUrl === 'string' && (
                      <div className="error">{errors.feedbackWebhookUrl}</div>
                    )}
                </div>
              </div>

              <div className="actions">
                <div className="flex justify-end">
                  <span className="ml-3 inline-flex rounded-md shadow-sm">
                    <Button
                      buttonType="primary"
                      type="submit"
                      disabled={isSubmitting || !isValid}
                    >
                      <ArrowDownOnSquareIcon />
                      <span>
                        {isSubmitting
                          ? intl.formatMessage(globalMessages.saving)
                          : intl.formatMessage(globalMessages.save)}
                      </span>
                    </Button>
                  </span>
                </div>
              </div>
            </Form>
          );
        }}
      </Formik>

      <div className="section mt-10">
        <h4 className="heading">
          {intl.formatMessage(messages.feedbackSection)}
        </h4>
        {!feedback?.length && (
          <p className="mt-4 text-sm text-gray-400">
            No feedback has been submitted yet.
          </p>
        )}
        {feedback?.length ? (
          <div className="mt-4 space-y-3">
            {feedback.slice(0, 20).map((entry) => (
              <div
                key={entry.id}
                className="rounded-md border border-gray-700 bg-gray-900/70 p-3 text-xs text-gray-200"
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {entry.type === 'error'
                      ? 'Error report'
                      : entry.type === 'collection'
                      ? 'Collection idea'
                      : 'Comment'}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    When: {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                {entry.userEmail || entry.userName ? (
                  <div className="mb-1 text-[11px] text-gray-400">
                    From: {entry.userName || entry.userEmail}
                  </div>
                ) : null}
                <div className="whitespace-pre-line">{entry.message}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
};

export default SettingsActivity;
