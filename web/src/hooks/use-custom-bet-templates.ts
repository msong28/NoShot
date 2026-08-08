import { useEffect, useState } from 'react';

const MAX_TEMPLATES = 20;

function storageKey(userId: string | undefined) {
  return `noshot-custom-bet-templates:${userId ?? ''}`;
}

function readStored(userId: string | undefined): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeStored(userId: string | undefined, templates: string[]) {
  window.localStorage.setItem(storageKey(userId), JSON.stringify(templates));
}

/**
 * User-curated "bets I want to repeat" list, distinct from the recent-bets
 * sheet's auto-derived history: this one only ever contains what the person
 * explicitly saved. Device-local (localStorage, keyed per user id) rather
 * than a synced table -- it's a personal quick-fill convenience, not
 * authoritative bet state, so it doesn't need the server-authority machinery
 * the rest of the app's data goes through.
 */
export function useCustomBetTemplates(userId: string | undefined) {
  const [templates, setTemplates] = useState<string[]>(() => readStored(userId));

  // Re-sync once the real userId resolves -- useSession() starts every
  // mount at undefined for a tick, so the initial read above may have used
  // the wrong (empty) key.
  useEffect(() => {
    setTemplates(readStored(userId));
  }, [userId]);

  function addTemplate(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTemplates((prev) => {
      if (prev.includes(trimmed)) return prev;
      const next = [trimmed, ...prev].slice(0, MAX_TEMPLATES);
      writeStored(userId, next);
      return next;
    });
  }

  function removeTemplate(text: string) {
    setTemplates((prev) => {
      const next = prev.filter((t) => t !== text);
      writeStored(userId, next);
      return next;
    });
  }

  return { templates, addTemplate, removeTemplate };
}
