export interface OrgUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
  lastActivityAt?: string;
}
