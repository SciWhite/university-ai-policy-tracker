"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getLocaleFromPathname } from "@/lib/i18n";
import { getShellMessages, interpolate } from "@/lib/i18n-messages";

const THEME_STORAGE_KEY = "uapt-theme";
const themePreferences = ["system", "light", "dark"] as const;

type ThemePreference = (typeof themePreferences)[number];

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const messages = getShellMessages(locale).theme;

  useEffect(() => {
    const stored = readStoredPreference();
    setPreference(stored);
    applyThemePreference(stored);
  }, []);

  function handleToggle() {
    const nextPreference = getNextPreference(preference);
    setPreference(nextPreference);
    storeThemePreference(nextPreference);
    applyThemePreference(nextPreference);
  }

  const label = messages[preference];

  return (
    <button
      aria-label={interpolate(messages.aria, { mode: label })}
      className="theme-toggle"
      onClick={handleToggle}
      type="button"
    >
      <span className="theme-toggle__label">{messages.label}</span>
      <span className="theme-toggle__value">{label}</span>
    </button>
  );
}

function getNextPreference(preference: ThemePreference): ThemePreference {
  const currentIndex = themePreferences.indexOf(preference);
  return themePreferences[(currentIndex + 1) % themePreferences.length];
}

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function storeThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") return;

  try {
    if (preference === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // localStorage can be unavailable in private or restricted contexts.
  }
}

function applyThemePreference(preference: ThemePreference) {
  if (typeof document === "undefined") return;

  if (preference === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.dataset.theme = preference;
  }
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}
