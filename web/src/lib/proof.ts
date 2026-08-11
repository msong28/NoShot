import type { ContentModerationStatus } from '@/lib/moderation';

export type ProofAsset = {
  id: string;
  bet_id: string;
  uploader_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  caption: string | null;
  moderation_status: ContentModerationStatus;
  created_at: string;
};

export const PROOF_ASSETS_BUCKET = 'proof-assets';

/** Matches the proof_assets_size_limit check constraint. */
export const MAX_PROOF_SIZE_BYTES = 10 * 1024 * 1024;
