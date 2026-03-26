import React, { useState } from 'react';
import { usePreferences } from '../context/PreferenceContext';
import { PreferenceUpdatePayload } from '../services/preferences/types';

export function UserOnboarding(): JSX.Element {
  const { preferences, updatePreferences } = usePreferences();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [preferencesData, setPreferencesData] = useState<PreferenceUpdatePayload>({});

  const steps = [
    { id: 'welcome', title: 'Welcome' },
    { id: 'theme', title: 'Appearance' },
    { id: 'language', title: 'Language & Region' },
    { id: 'notifications', title: 'Notifications' },
    { id: 'privacy', title: 'Privacy' },
    { id: 'sync', title: 'Synchronization' },
    { id: 'done', title: 'Complete' },
  ];

  const handleNext = async () => {
    if (currentStep === steps.length - 1) {
      // Save all preferences and mark onboarding as complete
      try {
        setSaving(true);
        await updatePreferences({
          ...preferencesData,
          onboarding: {
            completed: true,
            currentStep: steps.length,
            stepsCompleted: steps.length,
            skipped: [],
          },
        });
        // Onboarding complete!
      } catch (err) {
        console.error('Failed to save preferences:', err);
      } finally {
        setSaving(false);
      }
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleNext();
    }
  };

  const getStepContent = () => {
    const step = steps[currentStep].id;
    switch (step) {
      case 'welcome':
        return <WelcomeStep />;
      case 'theme':
        return (
          <ThemeStep
            preferences={preferencesData}
            onUpdate={(data) => setPreferencesData({ ...preferencesData, ...data })}
          />
        );
      case 'language':
        return (
          <LanguageStep
            preferences={preferencesData}
            onUpdate={(data) => setPreferencesData({ ...preferencesData, ...data })}
          />
        );
      case 'notifications':
        return (
          <NotificationsStep
            preferences={preferencesData}
            onUpdate={(data) => setPreferencesData({ ...preferencesData, ...data })}
          />
        );
      case 'privacy':
        return (
          <PrivacyStep
            preferences={preferencesData}
            onUpdate={(data) => setPreferencesData({ ...preferencesData, ...data })}
          />
        );
      case 'sync':
        return (
          <SyncStep
            preferences={preferencesData}
            onUpdate={(data) => setPreferencesData({ ...preferencesData, ...data })}
          />
        );
      case 'done':
        return <DoneStep />;
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        backgroundColor: 'var(--color-bg-primary)',
      }}
    >
      {/* Left sidebar with progress */}
      <div
        style={{
          width: '300px',
          backgroundColor: 'var(--color-bg-secondary)',
          borderRight: '1px solid var(--color-border)',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h1 style={{ marginTop: 0, fontSize: '20px', marginBottom: '32px' }}>Setup Wizard</h1>

        <div style={{ flex: 1 }}>
          {steps.map((step, idx) => (
            <div
              key={step.id}
              style={{
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor:
                    idx < currentStep
                      ? 'var(--color-success)'
                      : idx === currentStep
                        ? 'var(--color-accent)'
                        : 'var(--color-bg-primary)',
                  border: idx === currentStep ? 'none' : '2px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: idx < currentStep || idx === currentStep ? 'white' : 'var(--color-text-primary)',
                }}
              >
                {idx < currentStep ? '✓' : idx + 1}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color:
                    idx <= currentStep
                      ? 'var(--color-text-primary)'
                      : 'var(--color-text-secondary)',
                }}
              >
                {step.title}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          Step {currentStep + 1} of {steps.length}
        </div>
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '48px',
        }}
      >
        <div style={{ width: '100%', maxWidth: '500px' }}>
          {getStepContent()}
        </div>

        {/* Navigation buttons */}
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '24px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            backgroundColor: 'var(--color-bg-secondary)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          {currentStep > 0 && (
            <button
              onClick={handleBack}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                color: 'var(--color-accent)',
                border: '1px solid var(--color-accent)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Back
            </button>
          )}

          {currentStep < steps.length - 1 && (
            <button
              onClick={handleSkip}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Skip
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={saving}
            style={{
              padding: '10px 20px',
              backgroundColor: 'var(--color-accent)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : currentStep === steps.length - 1 ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Individual step components
function WelcomeStep(): JSX.Element {
  return (
    <div style={{ textAlign: 'center' }}>
      <h2 style={{ fontSize: '28px', marginBottom: '16px' }}>Welcome!</h2>
      <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
        Let's set up your preferences to personalize your experience. This should only take a few minutes.
      </p>
      <div
        style={{
          marginTop: '32px',
          padding: '16px',
          backgroundColor: 'var(--color-bg-secondary)',
          borderRadius: '4px',
          fontSize: '13px',
          color: 'var(--color-text-secondary)',
        }}
      >
        <p style={{ margin: '8px 0' }}>✓ You can change any settings later in Preferences</p>
        <p style={{ margin: '8px 0' }}>✓ Feel free to skip any steps you want to configure later</p>
        <p style={{ margin: '8px 0' }}>✓ All settings are automatically saved and synchronized</p>
      </div>
    </div>
  );
}

function ThemeStep({ preferences, onUpdate }: any): JSX.Element {
  const theme = preferences.theme?.theme || 'auto';

  return (
    <div>
      <h2 style={{ fontSize: '24px', marginBottom: '24px' }}>Choose Your Theme</h2>
      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
        Select how you'd like the interface to look.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        {(['light', 'dark', 'auto'] as const).map(option => (
          <button
            key={option}
            onClick={() => onUpdate({ theme: { theme: option } })}
            style={{
              padding: '24px',
              backgroundColor: theme === option ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
              border: theme === option ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
              borderRadius: '4px',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
            }}
          >
            <div
              style={{
                fontSize: '32px',
                marginBottom: '8px',
              }}
            >
              {option === 'light' ? '☀️' : option === 'dark' ? '🌙' : '🔄'}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function LanguageStep({ preferences, onUpdate }: any): JSX.Element {
  const language = preferences.display?.language || navigator.language.split('-')[0];

  return (
    <div>
      <h2 style={{ fontSize: '24px', marginBottom: '24px' }}>Language & Region</h2>
      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
        Set your preferred language and timezone.
      </p>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Language
        </label>
        <select
          value={language}
          onChange={(e) => onUpdate({ display: { language: e.target.value } })}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
          <option value="zh">中文</option>
          <option value="ja">日本語</option>
        </select>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Timezone
        </label>
        <input
          type="text"
          defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}
          onChange={(e) => onUpdate({ display: { timezone: e.target.value } })}
          placeholder="e.g., America/New_York"
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        />
      </div>
    </div>
  );
}

function NotificationsStep({ preferences, onUpdate }: any): JSX.Element {
  const channels = preferences.notifications?.enabledChannels || ['in-app'];

  const toggleChannel = (channel: string) => {
    const updated = channels.includes(channel)
      ? channels.filter((c: string) => c !== channel)
      : [...channels, channel];
    onUpdate({ notifications: { enabledChannels: updated } });
  };

  return (
    <div>
      <h2 style={{ fontSize: '24px', marginBottom: '24px' }}>Notifications</h2>
      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
        How would you like to receive notifications?
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {(['in-app', 'push', 'email'] as const).map(channel => (
          <label key={channel} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={channels.includes(channel)}
              onChange={() => toggleChannel(channel)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            {channel === 'in-app'
              ? '📱 In-app notifications'
              : channel === 'push'
                ? '🔔 Push notifications'
                : '💬 Email notifications'}
          </label>
        ))}
      </div>
    </div>
  );
}

function PrivacyStep({ preferences, onUpdate }: any): JSX.Element {
  const privacy = preferences.privacy || {};

  const toggleSetting = (key: string) => {
    onUpdate({ privacy: { ...privacy, [key]: !privacy[key] } });
  };

  return (
    <div>
      <h2 style={{ fontSize: '24px', marginBottom: '24px' }}>Privacy Preferences</h2>
      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
        Help us improve while respecting your privacy.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '13px' }}>
          <input
            type="checkbox"
            checked={privacy.analyticsTracking !== false}
            onChange={() => toggleSetting('analyticsTracking')}
            style={{ marginTop: '2px' }}
          />
          <span>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Allow Analytics</div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
              Help us understand how features are used
            </div>
          </span>
        </label>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '13px' }}>
          <input
            type="checkbox"
            checked={privacy.crashReports !== false}
            onChange={() => toggleSetting('crashReports')}
            style={{ marginTop: '2px' }}
          />
          <span>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Send Crash Reports</div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
              Automatically report errors to help fix issues
            </div>
          </span>
        </label>
      </div>
    </div>
  );
}

function SyncStep({ preferences, onUpdate }: any): JSX.Element {
  const enableSync = preferences.sync?.enableCloudSync !== false;

  return (
    <div>
      <h2 style={{ fontSize: '24px', marginBottom: '24px' }}>Synchronization</h2>
      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
        Sync your preferences across devices for a seamless experience.
      </p>

      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
        <input
          type="checkbox"
          checked={enableSync}
          onChange={(e) => onUpdate({ sync: { enableCloudSync: e.target.checked } })}
          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
        />
        <span>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Enable Cloud Synchronization</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            Your preferences will be synced across all your devices
          </div>
        </span>
      </label>
    </div>
  );
}

function DoneStep(): JSX.Element {
  return (
    <div style={{ textAlign: 'center' }}>
      <h2 style={{ fontSize: '28px', marginBottom: '16px' }}>All Set! 🎉</h2>
      <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
        Your preferences have been configured and saved. You can always adjust these settings later in your preferences.
      </p>
      <div
        style={{
          marginTop: '32px',
          padding: '16px',
          backgroundColor: 'var(--color-background-highlight)',
          borderRadius: '4px',
          fontSize: '13px',
          color: 'var(--color-text-secondary)',
        }}
      >
        <p style={{ margin: '8px 0', fontWeight: 600 }}>Welcome to your personalized experience! 🚀</p>
      </div>
    </div>
  );
}
