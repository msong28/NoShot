import type { ContentModerationStatus } from '@/lib/moderation';

export type Comment = {
  id: string;
  bet_id: string;
  author_id: string;
  body: string;
  moderation_status: ContentModerationStatus;
  created_at: string;
  removed_at: string | null;
};
