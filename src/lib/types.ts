// Firestore document shapes. Field names are snake_case and timestamps are
// ISO-8601 strings (sortable, serialisable to client components).
// See docs/database-schema.md.
import type { CustomerStatus, LeadSource, LeadStatus, PostType, ProjectStatus, TaskPriority, TaskStatus } from "@/lib/constants";

export interface Profile {
  id: string; full_name: string; avatar_url: string | null; account_type: "customer" | "contractor"; email?: string;
  is_suspended?: boolean; is_platform_admin?: boolean; business_id?: string | null; business_role?: "owner" | "admin" | "field" | "member" | null; created_at?: string;
}
export interface Service { id: string; slug: string; name: string; plural_name: string }
export interface Location { id: string; name: string; slug: string; level: "country" | "region" | "city"; country_code: string; parent_id: string | null }

export interface Business {
  id: string; owner_id: string; name: string; slug: string; tagline: string | null; description: string | null;
  phone: string | null; email: string | null; website: string | null; social_links: Record<string, string>;
  years_in_business: number | null; logo_url: string | null; cover_url: string | null; country_code: string;
  region_id: string | null; city: string | null; service_area: string | null; primary_service_id: string | null;
  is_public: boolean; is_verified: boolean; is_suspended: boolean; is_demo: boolean;
  onboarding_step: number; onboarding_completed_at: string | null;
  follower_count: number; post_count: number; completed_project_count: number; created_at: string; updated_at?: string;
  region: { id: string; name: string } | null;
  service_ids: string[];
  services: Pick<Service, "id" | "name" | "slug">[];
  primary_service: Pick<Service, "id" | "name" | "slug"> | null;
  name_lower: string;
}

export interface Customer {
  id: string; business_id: string; name: string; phone: string | null; email: string | null; address: string | null;
  city: string | null; notes: string | null; status: CustomerStatus; created_at: string; phone_digits?: string | null;
}

export interface Lead {
  id: string; business_id: string; name: string; phone: string | null; email: string | null; location: string | null;
  description: string | null; service_id: string | null; status: LeadStatus; source: LeadSource; estimated_value: number | null;
  assigned_to: string | null; customer_id: string | null; quote_request_id: string | null; created_at: string; status_changed_at: string;
  /** YYYY-MM-DD in the business timezone; cleared when the lead closes. */
  next_follow_up?: string | null; project_id?: string | null; lost_reason?: string | null;
  service_name?: string | null; customer_name?: string | null; quote?: { budget_range: string | null; timeline: string | null } | null;
}

export interface Project {
  id: string; business_id: string; customer_id: string | null; lead_id: string | null; name: string; description: string | null;
  location: string | null; start_date: string | null; expected_end_date: string | null; completed_at: string | null;
  status: ProjectStatus; budget: number | null; created_at: string;
  customer_name: string | null; member_ids: string[]; task_total: number; task_done: number; last_update_at?: string | null;
  /** Team member who answers for this job. */
  responsible_id?: string | null;
  /** Copy of the open task due soonest (owner: refreshNextTask in lib/data/workflow.ts). */
  next_task?: { id: string; title: string; due_date: string | null; assigned_to: string | null } | null;
}

export interface Task {
  id: string; project_id: string; title: string; description: string | null; assigned_to: string | null; due_date: string | null;
  priority: TaskPriority; status: TaskStatus; created_at: string; project_name?: string;
}

export interface PostMedia { id: string; url: string; label: "before" | "after" | null; position: number }
export interface FeedPost {
  id: string; business_id: string; type: PostType; caption: string | null; location_text: string | null; created_at: string;
  like_count: number; comment_count: number; save_count: number; project_id: string | null;
  business: Pick<Business, "id" | "name" | "slug" | "logo_url" | "is_verified" | "city" | "region_id">;
  service_id: string | null; is_public: boolean; is_hidden: boolean; author_id: string;
  service: Pick<Service, "name" | "slug"> | null;
  media: PostMedia[];
}

export interface TeamMember { user_id: string; full_name: string; avatar_url: string | null; role: "owner" | "admin" | "field" | "member" }

export interface MediaRef { id: string; path: string; name?: string | null }
export interface Media {
  id: string; project_id: string; kind: "image" | "file"; path: string; name: string | null; content_type: string; bytes: number;
  update_id: string | null; uploaded_by: string; created_at: string;
}

/**
 * The timeline. Notes ("note"), site updates ("update") and system events
 * share one collection so a single query tells the whole story of a lead,
 * customer or job. customer_id/lead_id/project_id link an entry to every
 * record it belongs to.
 */
export interface ActivityRow {
  id: string; action: string; summary: string; body?: string | null; media?: MediaRef[];
  actor_id?: string | null; actor_name?: string | null; created_at: string;
  entity_type: string; entity_id: string | null;
  customer_id?: string | null; lead_id?: string | null; project_id?: string | null;
}
