"use client";

import React, { useEffect, useMemo } from "react";
import { useProfile } from "../../lib/useProfile";

/**
 * Theme prefs schema stored in profiles.ui_prefs (jsonb)
 * Keep it simple and stable (string enums).
 */
type Accent = "blue" | "indigo" | "emerald" | "rose" | "slate";
type Density = "comfortable" | "compact";
type Radius = "md" | "lg" | "xl";

export type UiPrefs = {
  accent: Accent;
  density: Density;
  radius: Radius;
};

const DEFAULT_PREFS: UiPrefs = {
  accent: "blue",
  density: "comfortable",
  radius: "lg",
};

function isAccent(v: unknown): v is Accent {
  return v === "blue" || v === "indigo" || v === "emerald" || v === "rose" || v === "slate";
}
function isDensity(v: unknown): v is Density {
  return v === "comfortable" || v === "compact";
}
function isRadius(v: unknown): v is Radius {
  return v === "md" || v === "lg" || v === "xl";
}

/** Safely parse prefs coming from DB or localStorage */
function normalizePrefs(raw: any): UiPrefs {
  const base: UiPrefs = { ...DEFAULT_PREFS };

  if (!raw) return base;

  // Some exports / mistakes might store ui_prefs as a JSON string:
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return base;
    }
  }

  if (typeof raw !== "object") return base;

  if (isAccent(raw.accent)) base.accent = raw.accent;
  if (isDensity(raw.density)) base.density = raw.density;
  if (isRadius(raw.radius)) base.radius = raw.radius;

  return base;
}

function applyPrefsToDom(p: UiPrefs) {
  const root = document.documentElement;

  // Your globals.css already supports these datasets:
  root.dataset.accent = p.accent;
  root.dataset.density = p.density;
  root.dataset.radius = p.radius;
}

function readLocalPrefs(): UiPrefs | null {
  try {
    const v = localStorage.getItem("ts_theme_prefs");
    if (!v) return null;
    return normalizePrefs(v);
  } catch {
    return null;
  }
}

function writeLocalPrefs(p: UiPrefs) {
  try {
    localStorage.setItem("ts_theme_prefs", JSON.stringify(p));
  } catch {}
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile() as any;
  const profileAny = profile as any;

  // 1) On first mount: apply local prefs instantly (no waiting on Supabase)
  useEffect(() => {
    const local = readLocalPrefs();
    applyPrefsToDom(local ?? DEFAULT_PREFS);
  }, []);

  // 2) When profile arrives/changes: apply DB prefs, persist to localStorage
  const dbPrefs = useMemo(() => {
    return normalizePrefs(profileAny?.ui_prefs);
    // only react to actual ui_prefs changes, not whole profile object
  }, [profileAny?.id, profileAny?.ui_prefs]);

  useEffect(() => {
    if (!profileAny?.id) return;

    applyPrefsToDom(dbPrefs);
    writeLocalPrefs(dbPrefs);
  }, [profileAny?.id, dbPrefs.accent, dbPrefs.density, dbPrefs.radius]);

  // IMPORTANT:
  // - DO NOT auto-save to DB here.
  // - Saving is only done on /settings/appearance via explicit user action.

  return <>{children}</>;
}
