export type GroupStatus = 'active' | 'archived';

export type Group = {
  id: string;
  name: string;
  created_by: string;
  status: GroupStatus;
  created_at: string;
  archived_at: string | null;
};

export type GroupMemberRole = 'owner' | 'member';

export type GroupMemberStatus = 'invited' | 'active' | 'left' | 'removed' | 'declined';

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  invited_by: string | null;
  created_at: string;
  joined_at: string | null;
  left_at: string | null;
};
