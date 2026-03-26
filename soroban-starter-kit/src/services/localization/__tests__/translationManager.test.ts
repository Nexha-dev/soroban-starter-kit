import { beforeEach, describe, expect, it } from "vitest";
import { TranslationManager } from "../translationManager";

describe("TranslationManager", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("supports dynamic locale switching", () => {
    const manager = new TranslationManager();
    manager.setLocale("fr-FR");

    expect(manager.getState().locale).toBe("fr-FR");
    expect(manager.t("i18n.language")).toBe("Langue");
  });

  it("formats locale-specific currency and dates", () => {
    const manager = new TranslationManager();
    manager.setLocale("fr-FR");
    manager.setCurrency("EUR");

    const currency = manager.formatCurrency(1234.56);
    const date = manager.formatDate("2025-01-04T12:00:00.000Z", {
      timeZone: "UTC",
    });

    expect(currency).toContain("€");
    expect(date.length).toBeGreaterThan(0);
  });

  it("supports pluralization and context-aware lookup", () => {
    const manager = new TranslationManager();

    expect(manager.t("count.transactions", { count: 1 })).toContain(
      "1 transaction",
    );
    expect(manager.t("count.transactions", { count: 2 })).toContain(
      "2 transactions",
    );
    expect(manager.t("i18n.direction", { context: "rtl" })).toBe(
      "Right to left",
    );
  });

  it("detects missing translations and records analytics", () => {
    const manager = new TranslationManager();

    const fallback = manager.t("missing.key.example", {
      fallback: "fallback-value",
    });

    expect(fallback).toBe("fallback-value");
    expect(manager.missingTranslations().length).toBe(1);

    const analytics = manager.getAnalytics();
    expect(Object.keys(analytics.missingKeys).length).toBeGreaterThan(0);
  });

  it("supports community suggestions and approval flow", () => {
    const manager = new TranslationManager();

    const suggestion = manager.addCommunitySuggestion({
      key: "custom.welcome",
      locale: "es-ES",
      suggestedValue: "Bienvenidos comunidad",
      contributor: "qa-user",
    });

    manager.voteCommunitySuggestion(suggestion.id, 1);
    manager.approveCommunitySuggestion(suggestion.id);
    manager.setLocale("es-ES");

    expect(manager.t("custom.welcome")).toBe("Bienvenidos comunidad");
    expect(manager.getCommunitySuggestions("es-ES")[0].approved).toBe(true);
  });
});
