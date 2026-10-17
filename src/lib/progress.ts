"use client";

import { useCallback, useSyncExternalStore } from "react";

export const MASTER_ACCURACY = 85;

export interface DrillProgress {
  attempts: number;
  bestAccuracy: number;
  bestMs: number | null;
  completed: boolean;
  mastered: boolean;
}

export type ProgressMap = Record<string, DrillProgress>;

const STORAGE_KEY = "dev-dojo-progress-v1";
const LEGACY_STORAGE_KEY = "vim-dojo-progress-v1";
const EMPTY: ProgressMap = {};

export interface AttemptResult {
  accuracy: number;
  ms: number;
  hintUsed: boolean;
}

export function loadProgress(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    // migrate progress from the pre-"Dev Dojo" key once
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!window.localStorage.getItem(STORAGE_KEY) && legacy) {
      window.localStorage.setItem(STORAGE_KEY, legacy);
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProgressMap;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveProgress(progress: ProgressMap) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // storage may be unavailable (private mode) — progress just won't persist
  }
}

export function recordAttempt(
  progress: ProgressMap,
  drillId: string,
  result: AttemptResult,
): ProgressMap {
  const prev = progress[drillId];
  const mastered =
    (prev?.mastered || false) || (result.accuracy >= MASTER_ACCURACY && !result.hintUsed);
  const next: DrillProgress = {
    attempts: (prev?.attempts ?? 0) + 1,
    bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, result.accuracy),
    bestMs:
      prev?.bestMs === null || prev?.bestMs === undefined
        ? result.ms
        : Math.min(prev.bestMs, result.ms),
    completed: true,
    mastered,
  };
  return { ...progress, [drillId]: next };
}

export interface LessonProgress {
  completed: number;
  total: number;
  mastered: number;
  percent: number;
}

export function computeLessonProgress(
  progress: ProgressMap,
  drillIds: string[],
): LessonProgress {
  const total = drillIds.length;
  let completed = 0;
  let mastered = 0;
  for (const id of drillIds) {
    const p = progress[id];
    if (p?.completed) completed += 1;
    if (p?.mastered) mastered += 1;
  }
  const percent = total === 0 ? 0 : Math.round((mastered / total) * 100);
  return { completed, total, mastered, percent };
}

// ---------------------------------------------------------------------------
// external store so components read progress via useSyncExternalStore
// (avoids hydration mismatches and setState-in-effect)
// ---------------------------------------------------------------------------

let cache: ProgressMap | null = null;
const listeners = new Set<() => void>();

function ensure(): ProgressMap {
  if (cache === null) cache = loadProgress();
  return cache;
}

function getSnapshot(): ProgressMap {
  return ensure();
}

function getServerSnapshot(): ProgressMap {
  return EMPTY;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = loadProgress();
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function emit() {
  listeners.forEach((l) => l());
}

export function useProgress(): {
  progress: ProgressMap;
  record: (drillId: string, result: AttemptResult) => void;
} {
  const progress = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const record = useCallback((drillId: string, result: AttemptResult) => {
    cache = recordAttempt(ensure(), drillId, result);
    saveProgress(cache);
    emit();
  }, []);

  return { progress, record };
}
