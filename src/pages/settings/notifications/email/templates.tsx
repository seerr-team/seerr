import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import SettingsLayout from '@app/components/Settings/SettingsLayout';
import SettingsNotifications from '@app/components/Settings/SettingsNotifications';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import {
  ArrowLeftIcon,
  BeakerIcon,
  ChevronDownIcon,
  EyeIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { useRouter } from 'next/router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

// Notification type to enum value mapping
const NOTIFICATION_TYPE_VALUES: Record<string, number> = {
  MEDIA_PENDING: 2,
  MEDIA_APPROVED: 4,
  MEDIA_AVAILABLE: 8,
  MEDIA_FAILED: 16,
  TEST_NOTIFICATION: 32,
  MEDIA_DECLINED: 64,
  MEDIA_AUTO_APPROVED: 128,
  ISSUE_CREATED: 256,
  ISSUE_COMMENT: 512,
  ISSUE_RESOLVED: 1024,
  ISSUE_REOPENED: 2048,
  MEDIA_AUTO_REQUESTED: 4096,
};

const messages = defineMessages(
  'pages.settings.notifications.email.templates',
  {
    emailTemplates: 'Email Templates',
    emailTemplatesDescription:
      'Customize email templates with dynamic variables for personalized notifications. Choose between default templates or create your own custom ones.',
    templateVariables: 'Available Variables',
    variablesDescription:
      'Use these variables in your templates. They will be replaced with actual values when emails are sent.',
    save: 'Save Changes',
    saved: 'Templates saved successfully!',
    saveFailed: 'Failed to save templates.',
    useDefault: 'Use Default',
    useCustom: 'Use Custom',
    useCustomHtml: 'Use Custom HTML',
    useCustomHtmlDescription:
      'Enable this to use fully custom HTML without Jellyseerr styling (advanced)',
    testTemplate: 'Test',
    templateTested: 'Test email sent successfully!',
    testFailed: 'Failed to send test email.',
    previewTemplate: 'Preview',
    emailPreview: 'Email Preview',

    // Notification types
    mediaPending: 'New Media Request',
    mediaPendingDescription:
      'Sent to admins when a new media request is submitted',
    mediaApproved: 'Request Approved',
    mediaApprovedDescription: 'Sent to users when their request is approved',
    mediaAutoApproved: 'Request Auto-Approved',
    mediaAutoApprovedDescription:
      'Sent to users when their request is automatically approved',
    mediaAvailable: 'Media Available',
    mediaAvailableDescription:
      'Sent to users when their requested media becomes available',
    mediaDeclined: 'Request Declined',
    mediaDeclinedDescription: 'Sent to users when their request is declined',
    mediaFailed: 'Request Failed',
    mediaFailedDescription: 'Sent to users when their request fails',
    mediaAutoRequested: 'Auto-Requested',
    mediaAutoRequestedDescription:
      'Sent to admins when media is auto-requested',
    issueCreated: 'Issue Created',
    issueCreatedDescription: 'Sent when a new issue is reported',
    issueComment: 'Issue Comment',
    issueCommentDescription: 'Sent when a comment is added to an issue',
    issueResolved: 'Issue Resolved',
    issueResolvedDescription: 'Sent when an issue is marked as resolved',
    issueReopened: 'Issue Reopened',
    issueReopenedDescription: 'Sent when an issue is reopened',
    testNotification: 'Test Notification',
    testNotificationDescription: 'Template used for test email notifications',
  }
);

interface TemplateVariable {
  key: string;
  name: string;
  description: string;
  example: string;
}

interface NotificationTemplate {
  type: string;
  name: string;
  description: string;
  isUserNotification: boolean; // true if sent to requesting user, false if sent to admin
  notificationKey: string;
}

const EmailTemplatesPage = () => {
  useRouteGuard(Permission.ADMIN);
  const intl = useIntl();
  const router = useRouter();
  const { addToast } = useToasts();
  const [templates, setTemplates] = useState<
    Record<string, { subject: string; body: string; useCustomHtml?: boolean }>
  >({});
  const [templateModes, setTemplateModes] = useState<
    Record<string, 'default' | 'custom'>
  >({});
  const [showVariables, setShowVariables] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testingTemplate, setTestingTemplate] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    subject: string;
    html: string;
  } | null>(null);
  const [originalState, setOriginalState] = useState<{
    modes: Record<string, 'default' | 'custom'>;
    templates: Record<
      string,
      { subject: string; body: string; useCustomHtml?: boolean }
    >;
  }>({ modes: {}, templates: {} });

  const {
    data: templateData,
    error,
    isLoading,
  } = useSWR<{
    variables: TemplateVariable[];
    defaults: Record<string, { subject: string; body: string }>;
  }>('/api/v1/settings/notifications/email/template-variables');

  // Load current email settings to get existing custom templates
  const { data: emailSettings } = useSWR(
    '/api/v1/settings/notifications/email'
  );

  // Define all available notification templates (memoized to prevent infinite re-renders)
  const notificationTemplates: NotificationTemplate[] = useMemo(
    () => [
      {
        type: 'MEDIA_PENDING',
        name: intl.formatMessage(messages.mediaPending),
        description: intl.formatMessage(messages.mediaPendingDescription),
        isUserNotification: false,
        notificationKey: 'mediaPending',
      },
      {
        type: 'MEDIA_APPROVED',
        name: intl.formatMessage(messages.mediaApproved),
        description: intl.formatMessage(messages.mediaApprovedDescription),
        isUserNotification: true,
        notificationKey: 'mediaApproved',
      },
      {
        type: 'MEDIA_AUTO_APPROVED',
        name: intl.formatMessage(messages.mediaAutoApproved),
        description: intl.formatMessage(messages.mediaAutoApprovedDescription),
        isUserNotification: true,
        notificationKey: 'mediaAutoApproved',
      },
      {
        type: 'MEDIA_AVAILABLE',
        name: intl.formatMessage(messages.mediaAvailable),
        description: intl.formatMessage(messages.mediaAvailableDescription),
        isUserNotification: true,
        notificationKey: 'mediaAvailable',
      },
      {
        type: 'MEDIA_DECLINED',
        name: intl.formatMessage(messages.mediaDeclined),
        description: intl.formatMessage(messages.mediaDeclinedDescription),
        isUserNotification: true,
        notificationKey: 'mediaDeclined',
      },
      {
        type: 'MEDIA_FAILED',
        name: intl.formatMessage(messages.mediaFailed),
        description: intl.formatMessage(messages.mediaFailedDescription),
        isUserNotification: true,
        notificationKey: 'mediaFailed',
      },
      {
        type: 'MEDIA_AUTO_REQUESTED',
        name: intl.formatMessage(messages.mediaAutoRequested),
        description: intl.formatMessage(messages.mediaAutoRequestedDescription),
        isUserNotification: false,
        notificationKey: 'mediaAutoRequested',
      },
      {
        type: 'ISSUE_CREATED',
        name: intl.formatMessage(messages.issueCreated),
        description: intl.formatMessage(messages.issueCreatedDescription),
        isUserNotification: false,
        notificationKey: 'issueCreated',
      },
      {
        type: 'TEST_NOTIFICATION',
        name: intl.formatMessage(messages.testNotification),
        description: intl.formatMessage(messages.testNotificationDescription),
        isUserNotification: false,
        notificationKey: 'testNotification',
      },
    ],
    [intl]
  );

  useEffect(() => {
    if (emailSettings?.options?.customTemplates) {
      setTemplates(emailSettings.options.customTemplates);

      const modes: Record<string, 'default' | 'custom'> = {};
      notificationTemplates.forEach((template) => {
        const hasCustomTemplate =
          emailSettings.options.customTemplates[template.notificationKey]
            ?.subject ||
          emailSettings.options.customTemplates[template.notificationKey]?.body;
        modes[template.notificationKey] = hasCustomTemplate
          ? 'custom'
          : 'default';
      });
      setTemplateModes(modes);

      setOriginalState({
        modes: { ...modes },
        templates: { ...emailSettings.options.customTemplates },
      });
    } else {
      const modes: Record<string, 'default' | 'custom'> = {};
      notificationTemplates.forEach((template) => {
        modes[template.notificationKey] = 'default';
      });
      setTemplateModes(modes);

      setOriginalState({
        modes: { ...modes },
        templates: {},
      });
    }
  }, [emailSettings, notificationTemplates]);

  const toggleTemplateMode = useCallback(
    (notificationKey: string) => {
      const newMode =
        templateModes[notificationKey] === 'default' ? 'custom' : 'default';
      setTemplateModes({
        ...templateModes,
        [notificationKey]: newMode,
      });

      if (newMode === 'custom') {
        if (!templates[notificationKey]) {
          setTemplates({
            ...templates,
            [notificationKey]: {
              subject: '',
              body: '',
              useCustomHtml: false,
            },
          });
        }
      }
    },
    [templateModes, templates]
  );

  const updateTemplate = useCallback(
    (
      notificationKey: string,
      field: 'subject' | 'body' | 'useCustomHtml',
      value: string | boolean
    ) => {
      const newTemplates = {
        ...templates,
        [notificationKey]: {
          ...templates[notificationKey],
          [field]: value,
        },
      };
      setTemplates(newTemplates);
    },
    [templates]
  );

  // Memoized computation of templates with pending changes
  const templatesWithChanges = useMemo(() => {
    const changedTemplates: string[] = [];

    notificationTemplates.forEach((template) => {
      const currentMode = templateModes[template.notificationKey];
      const originalMode = originalState.modes[template.notificationKey];

      if (currentMode !== originalMode) {
        changedTemplates.push(template.notificationKey);
        return;
      }

      if (currentMode === 'custom') {
        const current = templates[template.notificationKey];
        const original = originalState.templates[template.notificationKey];

        const isComplete = current && current.subject && current.body;

        if (isComplete) {
          if (
            current.subject !== original?.subject ||
            current.body !== original?.body ||
            current.useCustomHtml !== original?.useCustomHtml
          ) {
            changedTemplates.push(template.notificationKey);
          }
        }
      }
    });

    return changedTemplates;
  }, [notificationTemplates, templateModes, templates, originalState]);

  const showSaveAllButton = templatesWithChanges.length > 1;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const templatesToSave: Record<
        string,
        { subject: string; body: string; useCustomHtml?: boolean }
      > = {};
      Object.entries(templateModes).forEach(([notificationKey, mode]) => {
        if (mode === 'custom' && templates[notificationKey]) {
          const template = templates[notificationKey];
          const isComplete = template.subject && template.body;

          if (isComplete) {
            templatesToSave[notificationKey] = template;
          }
        }
      });

      await axios.post('/api/v1/settings/notifications/email', {
        ...emailSettings,
        options: {
          ...emailSettings.options,
          customTemplates: templatesToSave,
        },
      });

      addToast(intl.formatMessage(messages.saved), {
        appearance: 'success',
        autoDismiss: true,
      });

      const newModes: Record<string, 'default' | 'custom'> = {};
      Object.entries(templateModes).forEach(([key, mode]) => {
        newModes[key] = mode;
      });
      setOriginalState({
        modes: newModes,
        templates: templatesToSave,
      });
    } catch (e) {
      addToast(intl.formatMessage(messages.saveFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsSaving(false);
    }
  }, [templateModes, templates, emailSettings, addToast, intl]);

  const handleSaveTemplate = useCallback(
    async (notificationKey: string) => {
      try {
        const currentTemplate = templates[notificationKey];
        const currentMode = templateModes[notificationKey];

        if (currentMode === 'custom') {
          if (
            !currentTemplate ||
            !currentTemplate.subject ||
            !currentTemplate.body
          ) {
            addToast(
              'Custom template must have both a subject and body. Please fill out both fields or switch back to default.',
              {
                appearance: 'error',
                autoDismiss: true,
              }
            );
            return;
          }
        }

        const templatesToSave: Record<
          string,
          { subject: string; body: string; useCustomHtml?: boolean }
        > = {
          ...(emailSettings?.options?.customTemplates || {}),
        };

        if (currentMode === 'custom' && currentTemplate) {
          const isComplete = currentTemplate.subject && currentTemplate.body;

          if (isComplete) {
            templatesToSave[notificationKey] = currentTemplate;
          }
        } else if (currentMode === 'default') {
          // Remove the template if switching back to default
          delete templatesToSave[notificationKey];
        }

        await axios.post('/api/v1/settings/notifications/email', {
          ...emailSettings,
          options: {
            ...emailSettings.options,
            customTemplates: templatesToSave,
          },
        });

        addToast('Template saved successfully!', {
          appearance: 'success',
          autoDismiss: true,
        });

        const newOriginalState = { ...originalState };
        newOriginalState.modes[notificationKey] = currentMode;
        if (currentMode === 'custom' && currentTemplate) {
          newOriginalState.templates[notificationKey] = currentTemplate;
        } else {
          delete newOriginalState.templates[notificationKey];
        }
        setOriginalState(newOriginalState);
      } catch (e) {
        addToast('Failed to save template.', {
          appearance: 'error',
          autoDismiss: true,
        });
      }
    },
    [templates, templateModes, emailSettings, originalState, addToast]
  );

  const testTemplate = useCallback(
    async (template: NotificationTemplate) => {
      setTestingTemplate(template.notificationKey);
      try {
        if (
          !emailSettings?.options?.smtpHost ||
          !emailSettings?.options?.smtpPort
        ) {
          addToast(
            'Email SMTP settings are not properly configured. Please configure hostname and port in email settings.',
            {
              appearance: 'error',
              autoDismiss: true,
            }
          );
          return;
        }

        if (!emailSettings?.options?.emailFrom) {
          addToast(
            'Email "From" address is not configured. Please configure the sender email address.',
            {
              appearance: 'error',
              autoDismiss: true,
            }
          );
          return;
        }

        const response = await axios.post(
          '/api/v1/settings/notifications/email/test-template',
          {
            notificationType: NOTIFICATION_TYPE_VALUES[template.type] || 32,
            settings: {
              enabled: emailSettings?.enabled || true,
              types: emailSettings?.types || 0,
              options: emailSettings?.options || {},
            },
          }
        );

        // If we get here, the API call succeeded
        if (response.status === 204 || response.status === 200) {
          addToast(intl.formatMessage(messages.templateTested), {
            appearance: 'success',
            autoDismiss: true,
          });
        } else {
          throw new Error('Unexpected response status');
        }
      } catch (e: unknown) {
        let errorMessage = intl.formatMessage(messages.testFailed);

        if (e && typeof e === 'object' && 'response' in e) {
          const axiosError = e as {
            response?: { status?: number; data?: { message?: string } };
          };
          if (axiosError.response?.status === 500) {
            errorMessage =
              'Email server error. Please check your SMTP settings.';
          } else if (axiosError.response?.status === 400) {
            errorMessage =
              'Invalid email configuration. Please verify your settings.';
          } else if (axiosError.response?.data?.message) {
            errorMessage = `Email test failed: ${axiosError.response.data.message}`;
          }
        } else if (e && typeof e === 'object' && 'request' in e) {
          // Network error
          errorMessage = 'Failed to connect to server. Please try again.';
        }

        addToast(errorMessage, {
          appearance: 'error',
          autoDismiss: true,
        });
      } finally {
        setTestingTemplate(null);
      }
    },
    [emailSettings, addToast, intl]
  );

  const showPreview = useCallback(
    async (template: NotificationTemplate) => {
      try {
        setPreviewTemplate(template.notificationKey);

        const currentTemplate = templates[template.notificationKey];
        const isCustomMode =
          templateModes[template.notificationKey] === 'custom';

        if (isCustomMode) {
          if (
            !currentTemplate ||
            !currentTemplate.subject ||
            !currentTemplate.body
          ) {
            addToast(
              'Custom template must have both a subject and body to preview. Please fill out both fields or switch to default mode.',
              {
                appearance: 'error',
                autoDismiss: true,
              }
            );
            setPreviewTemplate(null);
            return;
          }
        }

        const previewSettings = {
          enabled: emailSettings?.enabled || true,
          types: emailSettings?.types || 0,
          options: {
            ...(emailSettings?.options || {}),
            customTemplates: {
              ...(emailSettings?.options?.customTemplates || {}),
              ...(isCustomMode && currentTemplate
                ? {
                    [template.notificationKey]: currentTemplate,
                  }
                : {}),
            },
          },
        };

        const response = await axios.post(
          '/api/v1/settings/notifications/email/preview',
          {
            notificationType: NOTIFICATION_TYPE_VALUES[template.type] || 32,
            settings: previewSettings,
            useCustom: isCustomMode,
            templateName: template.name,
          }
        );

        setPreviewData(response.data);
      } catch (e) {
        addToast('Failed to generate email preview.', {
          appearance: 'error',
          autoDismiss: true,
        });
        setPreviewTemplate(null);
      }
    },
    [emailSettings, templateModes, templates, addToast]
  );

  const closePreview = useCallback(() => {
    setPreviewTemplate(null);
    setPreviewData(null);
  }, []);

  const VariableCard = memo(({ variable }: { variable: TemplateVariable }) => (
    <div className="mb-2 rounded-md border border-gray-600 bg-gray-800 p-2">
      <div className="flex items-center">
        <code className="rounded bg-indigo-900 px-1.5 py-0.5 text-xs text-indigo-300">
          {`{{${variable.key}}}`}
        </code>
        <span className="ml-2 text-sm font-medium text-white">
          {variable.name}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-300">{variable.description}</p>
      <p className="text-xs text-gray-400">Ex: {variable.example}</p>
    </div>
  ));

  if (error) {
    return <div>Error loading templates</div>;
  }

  return (
    <SettingsLayout>
      <SettingsNotifications>
        <div className="section">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="mb-4 flex items-center">
                <button
                  onClick={() => router.push('/settings/notifications/email')}
                  className="group flex items-center space-x-2 text-gray-300 transition-colors duration-200 hover:text-white"
                >
                  <ArrowLeftIcon className="h-5 w-5 transition-colors group-hover:text-indigo-400" />
                  <span className="text-sm font-medium">Email Settings</span>
                </button>
                <span className="mx-3 text-gray-600">•</span>
                <span className="text-sm text-gray-400">Templates</span>
              </div>
              <h1 className="text-3xl font-bold leading-tight text-gray-100">
                {intl.formatMessage(messages.emailTemplates)}
              </h1>
              <p className="mt-2 text-gray-300">
                {intl.formatMessage(messages.emailTemplatesDescription)}
              </p>
            </div>
            <div className="flex space-x-3">
              {/* Save All Changes button moved to sticky bottom position */}
            </div>
          </div>

          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="grid grid-cols-12 gap-6">
              {/* Templates */}
              <div className="col-span-8 space-y-6">
                <div className="grid gap-4">
                  <h2 className="text-xl font-semibold text-gray-100">
                    Admin Notifications
                  </h2>
                  {notificationTemplates
                    .filter((template) => !template.isUserNotification)
                    .map((template) => (
                      <TemplateCard
                        key={template.type}
                        template={template}
                        templateModes={templateModes}
                        templates={templates}
                        toggleTemplateMode={toggleTemplateMode}
                        updateTemplate={updateTemplate}
                        testTemplate={testTemplate}
                        testingTemplate={testingTemplate}
                        showPreview={showPreview}
                        handleSaveTemplate={handleSaveTemplate}
                        originalState={originalState}
                        intl={intl}
                        messages={messages}
                      />
                    ))}

                  <h2 className="mt-8 text-xl font-semibold text-gray-100">
                    User Notifications
                  </h2>
                  {notificationTemplates
                    .filter((template) => template.isUserNotification)
                    .map((template) => (
                      <TemplateCard
                        key={template.type}
                        template={template}
                        templateModes={templateModes}
                        templates={templates}
                        toggleTemplateMode={toggleTemplateMode}
                        updateTemplate={updateTemplate}
                        testTemplate={testTemplate}
                        testingTemplate={testingTemplate}
                        showPreview={showPreview}
                        handleSaveTemplate={handleSaveTemplate}
                        originalState={originalState}
                        intl={intl}
                        messages={messages}
                      />
                    ))}
                </div>
              </div>

              {/* Variables Sidebar */}
              <div className="col-span-4">
                <div className="sticky top-20">
                  <div className="rounded-lg border border-gray-600 bg-gray-800 p-4">
                    <button
                      onClick={() => setShowVariables(!showVariables)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <div className="flex items-center">
                        <InformationCircleIcon className="mr-2 h-4 w-4 text-indigo-400" />
                        <h3 className="text-sm font-medium text-white">
                          {intl.formatMessage(messages.templateVariables)}
                        </h3>
                      </div>
                      <ChevronDownIcon
                        className={`h-4 w-4 transform text-gray-400 transition-transform ${
                          showVariables ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {showVariables && (
                      <div className="mt-4">
                        <p className="mb-3 text-xs text-gray-300">
                          {intl.formatMessage(messages.variablesDescription)}
                        </p>
                        <div className="max-h-96 space-y-2 overflow-y-auto">
                          {templateData?.variables?.map((variable) => (
                            <VariableCard
                              key={variable.key}
                              variable={variable}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Save All Changes Button */}
        {showSaveAllButton && (
          <div className="fixed bottom-6 right-6 z-50">
            <Button
              buttonType="primary"
              buttonSize="lg"
              disabled={isSaving}
              onClick={handleSave}
              className="shadow-lg"
            >
              {isSaving ? (
                <LoadingSpinner />
              ) : (
                `Save All Changes (${templatesWithChanges.length})`
              )}
            </Button>
          </div>
        )}

        {/* Email Preview Modal */}
        <Transition show={!!previewTemplate}>
          <Modal
            title={intl.formatMessage(messages.emailPreview)}
            onCancel={closePreview}
            cancelText="Close"
            okButtonType="primary"
            onOk={closePreview}
            okText="Close"
            disableScrollLock={true}
          >
            {previewData && (
              <div className="space-y-4">
                <div>
                  <span className="mb-2 block text-sm font-medium text-gray-300">
                    Subject:
                  </span>
                  <div className="rounded-md bg-gray-700 p-3 font-mono text-sm text-white">
                    {previewData.subject}
                  </div>
                </div>

                <div>
                  <span className="mb-2 block text-sm font-medium text-gray-300">
                    Email Content:
                  </span>
                  <div
                    className="max-h-96 overflow-y-auto rounded-md bg-white p-4"
                    dangerouslySetInnerHTML={{ __html: previewData.html }}
                  />
                </div>
              </div>
            )}
          </Modal>
        </Transition>
      </SettingsNotifications>
    </SettingsLayout>
  );
};

// Template Card Component
const TemplateCard = memo(
  ({
    template,
    templateModes,
    templates,
    toggleTemplateMode,
    updateTemplate,
    testTemplate,
    testingTemplate,
    showPreview,
    handleSaveTemplate,
    originalState,
    intl,
    messages,
  }: {
    template: NotificationTemplate;
    templateModes: Record<string, 'default' | 'custom'>;
    templates: Record<
      string,
      { subject: string; body: string; useCustomHtml?: boolean }
    >;
    toggleTemplateMode: (notificationKey: string) => void;
    updateTemplate: (
      notificationKey: string,
      field: 'subject' | 'body' | 'useCustomHtml',
      value: string | boolean
    ) => void;
    testTemplate: (template: NotificationTemplate) => void;
    testingTemplate: string | null;
    showPreview: (template: NotificationTemplate) => void;
    handleSaveTemplate: (notificationKey: string) => void;
    originalState: {
      modes: Record<string, 'default' | 'custom'>;
      templates: Record<
        string,
        { subject: string; body: string; useCustomHtml?: boolean }
      >;
    };
    intl: ReturnType<typeof useIntl>;
    messages: ReturnType<typeof defineMessages>;
  }) => {
    const isCustom = templateModes[template.notificationKey] === 'custom';
    const isTestingThisTemplate = testingTemplate === template.notificationKey;
    const currentTemplate = templates[template.notificationKey];

    const canPreview =
      !isCustom ||
      (currentTemplate && currentTemplate.subject && currentTemplate.body);

    const hasTemplateChanges = () => {
      const currentMode = templateModes[template.notificationKey];
      const originalMode = originalState.modes[template.notificationKey];

      if (currentMode !== originalMode) return true;

      if (currentMode === 'custom') {
        const current = templates[template.notificationKey];
        const original = originalState.templates[template.notificationKey];

        const isComplete =
          current &&
          (current.useCustomHtml
            ? current.body
            : current.subject && current.body);

        if (isComplete) {
          return (
            current.subject !== original?.subject ||
            current.body !== original?.body ||
            current.useCustomHtml !== original?.useCustomHtml
          );
        }
      }

      return false;
    };

    return (
      <div className="rounded-lg border border-gray-600 bg-gray-800 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">{template.name}</h3>
            <p className="text-sm text-gray-400">{template.description}</p>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              buttonSize="sm"
              buttonType="primary"
              disabled={!hasTemplateChanges()}
              onClick={() => handleSaveTemplate(template.notificationKey)}
            >
              Save Change
            </Button>

            <Button
              buttonSize="sm"
              buttonType="ghost"
              disabled={!canPreview}
              onClick={() => showPreview(template)}
              title={
                !canPreview
                  ? 'Both subject and body are required to preview custom template'
                  : undefined
              }
            >
              <EyeIcon className="mr-1 h-4 w-4" />
              {intl.formatMessage(messages.previewTemplate)}
            </Button>

            <Button
              buttonSize="sm"
              buttonType="warning"
              disabled={isTestingThisTemplate}
              onClick={() => testTemplate(template)}
            >
              <BeakerIcon className="mr-1 h-4 w-4" />
              {isTestingThisTemplate
                ? 'Testing...'
                : intl.formatMessage(messages.testTemplate)}
            </Button>

            {/* Template Mode Toggle */}
            <div className="flex items-center space-x-2">
              <span
                className={`text-sm ${
                  !isCustom ? 'text-white' : 'text-gray-400'
                }`}
              >
                Default
              </span>
              <button
                onClick={() => toggleTemplateMode(template.notificationKey)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  isCustom ? 'bg-indigo-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    isCustom ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
              <span
                className={`text-sm ${
                  isCustom ? 'text-white' : 'text-gray-400'
                }`}
              >
                Custom
              </span>
            </div>
          </div>
        </div>

        {isCustom ? (
          <div className="space-y-3">
            <div>
              <label
                htmlFor={`subject-${template.notificationKey}`}
                className="mb-1 block text-sm font-medium text-gray-300"
              >
                Subject:
              </label>
              <input
                id={`subject-${template.notificationKey}`}
                type="text"
                className="w-full rounded-md border-gray-600 bg-gray-700 text-sm text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={templates[template.notificationKey]?.subject || ''}
                onChange={(e) =>
                  updateTemplate(
                    template.notificationKey,
                    'subject',
                    e.target.value
                  )
                }
                placeholder={`Custom subject for ${template.name.toLowerCase()}`}
                autoComplete="off"
                data-form-type="other"
              />
            </div>

            <div>
              <label
                htmlFor={`body-${template.notificationKey}`}
                className="mb-1 block text-sm font-medium text-gray-300"
              >
                Body:
              </label>
              <textarea
                id={`body-${template.notificationKey}`}
                rows={
                  templates[template.notificationKey]?.useCustomHtml ? 12 : 6
                }
                className="w-full rounded-md border-gray-600 bg-gray-700 text-sm text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={templates[template.notificationKey]?.body || ''}
                onChange={(e) =>
                  updateTemplate(
                    template.notificationKey,
                    'body',
                    e.target.value
                  )
                }
                placeholder={
                  templates[template.notificationKey]?.useCustomHtml
                    ? `Full HTML email content (e.g. <html><body><h1>Custom Email</h1></body></html>)`
                    : `Custom body template using variables like {{user_name}}, {{media_name}}, etc.`
                }
                autoComplete="off"
                data-form-type="other"
              />
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id={`useCustomHtml-${template.notificationKey}`}
                checked={
                  templates[template.notificationKey]?.useCustomHtml || false
                }
                onChange={(e) =>
                  updateTemplate(
                    template.notificationKey,
                    'useCustomHtml',
                    e.target.checked
                  )
                }
                className="rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor={`useCustomHtml-${template.notificationKey}`}
                className="text-sm text-gray-300"
              >
                {intl.formatMessage(messages.useCustomHtml)}
              </label>
            </div>
            {templates[template.notificationKey]?.useCustomHtml && (
              <div className="rounded border border-amber-600 bg-amber-900/20 p-2 text-xs text-amber-400">
                <strong>Advanced Mode:</strong>{' '}
                {intl.formatMessage(messages.useCustomHtmlDescription)}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-3">
            <div className="text-center text-gray-400">
              <div className="flex items-center justify-center text-sm">
                <InformationCircleIcon className="mr-2 h-4 w-4 flex-shrink-0 text-indigo-400" />
                <span>
                  Using default template. Click <strong>Preview</strong> to see
                  full design.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

// Set display name for debugging
TemplateCard.displayName = 'TemplateCard';

export default EmailTemplatesPage;
