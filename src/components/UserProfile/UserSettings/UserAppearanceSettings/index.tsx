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
    themeTip:
      'Choose how Seerr looks to you. This setting is stored locally in your browser.',
    themeDefaultName: 'Default',
    themeDefaultDescription: 'Classic dark theme',
    themeAmoledStrixName: 'AMOLED Strix',
    themeAmoledStrixDescription:
      'Pure black with violet accents, optimized for OLED displays',
  }
);

const UserAppearanceSettings = () => {
  const intl = useIntl();
  const { theme, setTheme } = useTheme();

  const themeNames: Record<string, { name: string; description: string }> = {
    default: {
      name: intl.formatMessage(messages.themeDefaultName),
      description: intl.formatMessage(messages.themeDefaultDescription),
    },
    'amoled-strix': {
      name: intl.formatMessage(messages.themeAmoledStrixName),
      description: intl.formatMessage(messages.themeAmoledStrixDescription),
    },
  };

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
            const [bg, surface, accent] = t.swatches;
            const info = themeNames[t.id];

            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setTheme(t.id)}
                className={`relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
                  isActive
                    ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
                    : 'border-gray-700 hover:border-gray-500'
                }`}
                style={{ background: bg }}
              >
                <div
                  className="relative h-24 w-full overflow-hidden"
                  style={{ background: bg }}
                >
                  <div
                    className="absolute left-0 top-0 h-full w-10"
                    style={{
                      background: surface,
                      borderRight: `1px solid ${accent}22`,
                    }}
                  />
                  <div className="absolute left-14 top-4 space-y-2">
                    <div
                      className="h-2 w-24 rounded"
                      style={{ background: accent, opacity: 0.8 }}
                    />
                    <div
                      className="h-2 w-16 rounded"
                      style={{ background: surface }}
                    />
                    <div
                      className="h-2 w-20 rounded"
                      style={{ background: surface }}
                    />
                  </div>
                  <div
                    className="absolute bottom-3 right-3 h-10 w-16 rounded-lg"
                    style={{
                      background: surface,
                      border: `1px solid ${accent}33`,
                    }}
                  />
                  {isActive && (
                    <div
                      className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ background: accent }}
                    >
                      <svg
                        className="h-3 w-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                <div
                  className="flex items-center justify-between px-3 py-2"
                  style={{ background: surface }}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-100">
                      {info?.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {info?.description}
                    </p>
                  </div>
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
