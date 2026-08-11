export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  responded_at: string | null;
};

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
};
