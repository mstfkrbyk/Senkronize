export interface OrganizationDetail {
  id: string;
  slug: string;
  name: string;
  type: string;
  logoUrl: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
}
