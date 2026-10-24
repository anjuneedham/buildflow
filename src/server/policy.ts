// Authorization policy: the single place that decides what each business
// role may do (ARCHITECTURE_V2.md §5.3). Pure functions, unit-tested in
// tests/policy.test.ts. Server actions and pages ask `can(role, permission)`;
// resource checks (e.g. "is this field member on this job?") happen in the
// caller after loading the resource.

export const ROLES = ["owner", "admin", "field"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, { label: string; description: string }> = {
  owner: { label: "Owner", description: "Everything, including billing and deleting the business." },
  admin: { label: "Admin", description: "Office or partner: leads, customers, jobs, profile and team. No billing." },
  field: { label: "Crew", description: "Only the jobs they're assigned to: tasks and site photos. No leads or customers." },
};

/** V1 stored "member" (who could see everything); that is today's "admin". */
export function normalizeRole(role: unknown): Role {
  return role === "owner" || role === "field" ? role : "admin";
}

export type Permission =
  | "crm"                // leads, customers, notes on them
  | "projects.manage"    // create/edit/delete jobs, assign crew, see all jobs
  | "projects.work"      // tasks and photos on jobs they can access
  | "profile.edit"       // public profile and posts
  | "analytics.view"
  | "team.manage"        // invite, remove, change roles (never the owner)
  | "records.delete"     // delete leads, customers, jobs
  | "billing.manage";

const MATRIX: Record<Permission, readonly Role[]> = {
  "crm": ["owner", "admin"],
  "projects.manage": ["owner", "admin"],
  "projects.work": ["owner", "admin", "field"],
  "profile.edit": ["owner", "admin"],
  "analytics.view": ["owner", "admin"],
  "team.manage": ["owner", "admin"],
  "records.delete": ["owner", "admin"],
  "billing.manage": ["owner"],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return Boolean(role && MATRIX[permission].includes(role));
}

/** Field crew only see jobs they're assigned to. */
export function canAccessProject(role: Role, userId: string, project: { member_ids?: string[] | null }) {
  return can(role, "projects.manage") || (project.member_ids ?? []).includes(userId);
}

/** Roles a given actor may assign when inviting or changing someone. */
export function assignableRoles(actor: Role): Role[] {
  return can(actor, "team.manage") ? ["admin", "field"] : [];
}
