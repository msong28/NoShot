export type ModerationTier = 'block' | 'warn' | 'permit';

/** The stored status on a moderated row (comments, chat_messages, proof_assets) --
 * distinct from ModerationTier, which is the classifier's raw output before
 * it's mapped onto this column. */
export type ContentModerationStatus = 'approved' | 'pending_review' | 'blocked';

/**
 * Advisory-only mirror of the server's moderate_text() (see the currencies
 * migration). Gives fast pre-submit feedback in the UI; the database
 * trigger is the actual authority and re-checks everything server-side --
 * this can never be the only thing standing between a user and a blocked
 * submission. Keep the two word lists in sync when either changes.
 */
const BLOCK_TERMS = [
  'kill',
  'murder',
  'stab',
  'shoot',
  'punch',
  'beat up',
  'assault',
  'torture',
  'maim',
  'behead',
  'waterboard',
  'rape',
  'molest',
  'sexual favor',
  'sexual favour',
  'sell sex',
  'prostitut',
  'child porn',
  'child abuse',
  'suicide',
  'self harm',
  'self-harm',
  'cut yourself',
  'cut myself',
  'overdose',
  'heroin',
  'cocaine',
  'crystal meth',
  'methamphetamine',
  'fentanyl',
  'illegal gun',
  'illegal firearm',
  'illegal weapon',
  'hitman',
];

const WARN_TERMS = [
  'shots',
  'chug',
  'binge drink',
  'get drunk',
  'blackout drunk',
  'humiliat',
  'degrad',
  'embarrass',
  'ghost pepper',
  'cinnamon challenge',
  'raw egg',
  'eat the whole',
  'ice bucket',
];

export function moderateText(text: string): ModerationTier {
  const normalized = text.toLowerCase();

  if (BLOCK_TERMS.some((term) => normalized.includes(term))) {
    return 'block';
  }
  if (WARN_TERMS.some((term) => normalized.includes(term))) {
    return 'warn';
  }
  return 'permit';
}
