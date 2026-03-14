import PageTitle from '@app/components/Common/PageTitle';
import { THEMES } from '@app/context/ThemeContext';
import useTheme from '@app/hooks/useTheme';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserAppearanceSettings',
  {
    appearance: 'Appearance',
    appearancesettings: 'Appearance Settings',
    themeLabel: 'Theme',
    themeTip: 'Choose how Seerr looks to you. This setting is stored locally in your browser.',
  }
);

const UserAppearanceSettings = () => {
  const intl = useIntl();
  const { theme, setTheme } = useTheme();

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.appearance),
          intl.formatMessage(messages.appearancesettings),
        ]}
      />
      <div className="section">
        <h3 className="heading">
          {intl.formatMessage(messages.appearancesettings)}
        </h3>
        <p className="description">
          {intl.formatMessage(messages.themeTip)}
        </p>
      </div>

      <div className="section">
        <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-400">
          {intl.formatMessage(messages.themeLabel)}
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((t) => {
            const isActive = theme === t.id;
            const [bgColor = '#1f2937', surfaceColor = '#374151', accentColor = '#6366f1'] = t.swatches;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition duration-200 focus:outline-none ${
                  isActive
                    ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
                    : 'border-gray-700 hover:border-gray-500'
                }`}
                style={{ background: bgColor }}
              >
                {/* Preview area */}
                <div
                  className="relative h-24 w-full overflow-hidden"
                  style={{ background: bgColor }}
                >
                  {/* Mock sidebar strip */}
                  <div
                    className="absolute left-0 top-0 h-full w-10"
                    style={{ background: surfaceColor, borderRight: `1px solid ${accentColor}22` }}
                  />
                  {/* Mock content bars */}
                  <div className="absolute left-14 top-4 space-y-2">
                    <div
                      className="h-2 w-24 rounded"
                      style={{ background: accentColor, opacity: 0.8 }}
                    />
                    <div
                      className="h-2 w-16 rounded"
                      style={{ background: surfaceColor }}
                    />
                    <div
                      className="h-2 w-20 rounded"
                      style={{ background: surfaceColor }}
                    />
                  </div>
                  {/* Mock card */}
                  <div
                    className="absolute bottom-3 right-3 h-10 w-16 rounded-lg"
                    style={{ background: surfaceColor, border: `1px solid ${accentColor}33` }}
                  />
                  {/* Active check badge */}
                  {isActive && (
                    <div
                      className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ background: accentColor }}
                    >
                      <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info area */}
                <div
                  className="flex items-center justify-between px-3 py-2"
                  style={{ background: surfaceColor }}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-100">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.description}</p>
                  </div>
                  {/* Color swatches */}
                  <div className="flex gap-1">
                    {t.swatches.map((color, i) => (
                      <span
                        key={i}
                        className="h-3 w-3 rounded-full border border-gray-600"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default UserAppearanceSettings;
