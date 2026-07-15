export type ProfileStatus = 'active' | 'suspended' | 'deleted';

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  birth_year: number | null;
  age_acknowledged_at: string | null;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Mirrors the `profiles_username_format` DB constraint, for fast client-side feedback. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export const MIN_AGE = 16;
