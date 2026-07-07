export interface AuthStateRow {
  id: string;
  session_id: string;
  creds: string;
  updated_at: string;
}

export interface AuthKeyRow {
  id: string;
  session_id: string;
  key_id: string;
  key_data: string;
  created_at: string;
  updated_at: string;
}
