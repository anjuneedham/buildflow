// Hand-maintained row types for the tables the UI reads. Regenerate with
// `supabase gen types typescript` once the schema stabilises.
import type { CustomerStatus, LeadSource, LeadStatus, PostType, ProjectStatus, TaskPriority, TaskStatus } from "@/lib/constants";

export interface Profile { id: string; full_name: string; avatar_url: string | null; account_type: "customer" | "contractor"; is_suspended?: boolean }
export interface Service { id: string; slug: string; name: string; plural_name: string }
export interface Location { id: string; name: string; slug: string; level: "country" | "region" | "city"; country_code: string; parent_id: string | null }

export interface Business {
  id: string; owner_id: string; name: string; slug: string; tagline: string | null; description: string | null;
  phone: string | null; email: string | null; website: string | null; social_links: Record<string, string>;
  years_in_business: number | null; logo_url: string | null; cover_url: string | null; country_code: string;
  region_id: string | null; city: string | null; service_area: string | null; primary_service_id: string | null;
  is_public: boolean; is_verified: boolean; is_suspended: boolean; is_demo: boolean;
  onboarding_step: number; onboarding_completed_at: string | null;
  follower_count: number; post_count: number; completed_project_count: number; created_at: string;
  region?: { name: string } | null;
}

export interface Customer {
  id: string; business_id: string; name: string; phone: string | null; email: string | null; address: string | null;
  city: string | null; notes: string | null; status: CustomerStatus; created_at: string;
}

export interface Lead {
  id: string; business_id: string; name: string; phone: string | null; email: string | null; location: string | null;
  description: string | null; service_id: string | null; status: LeadStatus; source: LeadSource; estimated_value: number | null;
  assigned_to: string | null; customer_id: string | null; quote_request_id: string | null; created_at: string; status_changed_at: string;
}

export interface Project {
  id: string; business_id: string; customer_id: string | null; lead_id: string | null; name: string; description: string | null;
  location: string | null; start_date: string | null; expected_end_date: string | null; completed_at: string | null;
  status: ProjectStatus; budget: number | null; created_at: string;
}

export interface Task {
  id: string; project_id: string; title: string; description: string | null; assigned_to: string | null; due_date: string | null;
  priority: TaskPriority; status: TaskStatus; created_at: string;
}

export interface PostMedia { id: string; url: string; label: "before" | "after" | null; position: number }
export interface FeedPost {
  id: string; business_id: string; type: PostType; caption: string | null; location_text: string | null; created_at: string;
  like_count: number; comment_count: number; save_count: number; project_id: string | null;
  business: Pick<Business, "id" | "name" | "slug" | "logo_url" | "is_verified" | "city">;
  service: Pick<Service, "name" | "slug"> | null;
  media: PostMedia[];
}

export interface TeamMember { user_id: string; full_name: string; avatar_url: string | null; role: "owner" | "member" }
