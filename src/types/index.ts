export type LocationPrivacy = "public" | "approximate" | "private";
export type PronounPreference = "neutral" | "masculine" | "feminine" | "none";
export type FindStatus = "pending" | "approved" | "disputed" | "rejected";

export interface Find {
  id: string;
  user_id: string | null;
  found_at: string;
  photo_url: string;
  lat: number | null;
  lng: number | null;
  location_privacy: LocationPrivacy;
  location_name: string | null;
  notes: string | null;
  status: FindStatus;
  created_at: string;
  clovers?: Clover[];
  users?: { username: string } | null;
}

export interface Clover {
  id: string;
  find_id: string;
  leaf_count: number;
  annotation_x: number | null;
  annotation_y: number | null;
  annotation_radius: number | null;
  annotation_rotation: number | null;
}

export interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  trusted: boolean;
  created_at: string;
  pronouns: PronounPreference;
}
