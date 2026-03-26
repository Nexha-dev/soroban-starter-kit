import React, { useMemo, useState } from "react";
import { CURRENCY_OPTIONS } from "../i18n/config";
import { useLocalization } from "../context/LocalizationContext";

const COMMON_TIMEZONES = [
  "UTC",
  "Europe/Paris",
  "Europe/Madrid",
  "Asia/Riyadh",
  "America/New_York",
];

export function LocalizationSettings(): JSX.Element {
  const {
    locale,
    currency,
    timezone,
    supportedLocales,
    localeConfig,
    isRTL,
    t,
    setLocale,
    setCurrency,
    setTimezone,
    analytics,
    missingTranslations,
    communitySuggestions,
    addCommunitySuggestion,
    voteCommunitySuggestion,
    approveCommunitySuggestion,
    exportLocalizationState,
    importLocalizationState,
    refreshLocalizationInsights,
    formatDate,
  } = useLocalization();

  const [showPanel, setShowPanel] = useState(false);
  const [suggestionKey, setSuggestionKey] = useState("");
  const [suggestionValue, setSuggestionValue] = useState("");
  const [contributor, setContributor] = useState("community-user");

  const topMissing = useMemo(
    () =>
      Object.entries(analytics.missingKeys)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    [analytics.missingKeys],
  );

  const handleImport = (): void => {
    const raw = prompt(`${t("i18n.import")}:`);
    if (!raw) return;
    importLocalizationState(raw);
  };

  const handleAddSuggestion = (): void => {
    if (!suggestionKey.trim() || !suggestionValue.trim()) return;

    addCommunitySuggestion({
      key: suggestionKey.trim(),
      locale,
      suggestedValue: suggestionValue.trim(),
      contributor: contributor.trim() || "community-user",
    });

    setSuggestionKey("");
    setSuggestionValue("");
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        className="btn btn-secondary"
        onClick={() => {
          setShowPanel((v) => !v);
          if (!showPanel) refreshLocalizationInsights();
        }}
        aria-label="Localization settings"
        title="Localization settings"
      >
        🌐
      </button>

      {showPanel && (
        <div
          className="card"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: "min(480px, 95vw)",
            zIndex: 110,
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-md)",
            maxHeight: "70vh",
            overflow: "auto",
          }}
        >
          <div className="flex items-center justify-between">
            <strong>{t("i18n.language")}</strong>
            <span className="text-muted">
              {isRTL ? t("i18n.direction.rtl") : t("i18n.direction.ltr")}
            </span>
          </div>

          <div className="flex gap-sm" style={{ flexWrap: "wrap" }}>
            <select
              className="form-input"
              style={{ flex: 1, minWidth: 180 }}
              value={locale}
              onChange={(e) => setLocale(e.target.value as typeof locale)}
              aria-label={t("i18n.language")}
            >
              {supportedLocales.map((entry) => (
                <option key={entry} value={entry}>
                  {localeConfig[entry].languageName}
                </option>
              ))}
            </select>

            <select
              className="form-input"
              style={{ width: 120 }}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label={t("i18n.currency")}
            >
              {CURRENCY_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>

            <select
              className="form-input"
              style={{ flex: 1, minWidth: 170 }}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              aria-label="Timezone"
            >
              {COMMON_TIMEZONES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-sm">
            <button
              className="btn btn-secondary"
              onClick={() =>
                navigator.clipboard?.writeText(exportLocalizationState())
              }
            >
              📋 {t("i18n.export")}
            </button>
            <button className="btn btn-secondary" onClick={handleImport}>
              📥 {t("i18n.import")}
            </button>
          </div>

          <div>
            <strong>{t("i18n.analytics")}</strong>
            <div
              className="text-muted"
              style={{ fontSize: "0.875rem", marginTop: "var(--spacing-xs)" }}
            >
              Switches: {analytics.localeSwitches} • RTL sessions:{" "}
              {analytics.rtlSessions} • Last refresh:{" "}
              {formatDate(analytics.recordedAt)}
            </div>
            <div className="text-muted" style={{ fontSize: "0.875rem" }}>
              Formatters → Number: {analytics.formatterUsage.number}, Currency:{" "}
              {analytics.formatterUsage.currency}, Date:{" "}
              {analytics.formatterUsage.date}, Relative:{" "}
              {analytics.formatterUsage.relativeTime}, List:{" "}
              {analytics.formatterUsage.list}
            </div>
          </div>

          <div>
            <strong>{t("i18n.missing")}</strong>
            <div
              className="text-muted"
              style={{ fontSize: "0.875rem", marginTop: "var(--spacing-xs)" }}
            >
              Total reports: {missingTranslations.length}
            </div>
            {topMissing.length > 0 ? (
              <ul
                style={{
                  marginTop: "var(--spacing-xs)",
                  paddingInlineStart: "20px",
                }}
              >
                {topMissing.map(([key, count]) => (
                  <li
                    key={key}
                    className="text-muted"
                    style={{ fontSize: "0.875rem" }}
                  >
                    {key} ({count})
                  </li>
                ))}
              </ul>
            ) : (
              <div
                className="text-muted"
                style={{ fontSize: "0.875rem", marginTop: "var(--spacing-xs)" }}
              >
                No missing keys yet.
              </div>
            )}
          </div>

          <div>
            <strong>{t("i18n.community")}</strong>
            <div
              className="flex gap-sm"
              style={{ marginTop: "var(--spacing-sm)", flexWrap: "wrap" }}
            >
              <input
                className="form-input"
                style={{ flex: 1, minWidth: 120 }}
                placeholder="key"
                value={suggestionKey}
                onChange={(e) => setSuggestionKey(e.target.value)}
              />
              <input
                className="form-input"
                style={{ flex: 2, minWidth: 150 }}
                placeholder="translation"
                value={suggestionValue}
                onChange={(e) => setSuggestionValue(e.target.value)}
              />
              <input
                className="form-input"
                style={{ width: 130 }}
                placeholder="contributor"
                value={contributor}
                onChange={(e) => setContributor(e.target.value)}
              />
              <button className="btn btn-primary" onClick={handleAddSuggestion}>
                Add
              </button>
            </div>

            <div
              style={{
                marginTop: "var(--spacing-sm)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--spacing-xs)",
              }}
            >
              {communitySuggestions.slice(0, 6).map((entry) => (
                <div
                  key={entry.id}
                  className="card"
                  style={{ padding: "var(--spacing-sm)" }}
                >
                  <div style={{ fontSize: "0.875rem" }}>
                    <strong>{entry.key}</strong> → {entry.suggestedValue}
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                    by {entry.contributor} • votes {entry.votes}{" "}
                    {entry.approved ? "• approved" : ""}
                  </div>
                  <div
                    className="flex gap-sm"
                    style={{ marginTop: "var(--spacing-xs)" }}
                  >
                    <button
                      className="btn btn-secondary"
                      onClick={() => voteCommunitySuggestion(entry.id, 1)}
                    >
                      👍
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => voteCommunitySuggestion(entry.id, -1)}
                    >
                      👎
                    </button>
                    {!entry.approved && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => approveCommunitySuggestion(entry.id)}
                      >
                        ✅ Approve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
