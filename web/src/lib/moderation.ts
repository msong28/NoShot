export type ModerationTier = 'block' | 'warn' | 'permit';

/** The stored status on a moderated row (comments, chat_messages, proof_assets) --
 * distinct from ModerationTier, which is the classifier's raw output before
 * it's mapped onto this column. */
export type ContentModerationStatus = 'approved' | 'pending_review' | 'blocked';
