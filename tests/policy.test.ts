import { test } from "node:test";
import assert from "node:assert/strict";
import { assignableRoles, can, canAccessProject, normalizeRole, type Permission, type Role } from "../src/server/policy.ts";

const expected: Record<Permission, Role[]> = {
  "crm": ["owner", "admin"], "projects.manage": ["owner", "admin"], "projects.work": ["owner", "admin", "field"],
  "profile.edit": ["owner", "admin"], "analytics.view": ["owner", "admin"], "team.manage": ["owner", "admin"],
  "records.delete": ["owner", "admin"], "billing.manage": ["owner"],
};

test("permission matrix", () => {
  for (const [perm, allowed] of Object.entries(expected) as [Permission, Role[]][]) {
    for (const role of ["owner", "admin", "field"] as Role[]) {
      assert.equal(can(role, perm), allowed.includes(role), `${role} ${perm}`);
    }
  }
});

test("no role means no access", () => {
  assert.equal(can(null, "projects.work"), false);
});

test("legacy member role maps to admin", () => {
  assert.equal(normalizeRole("member"), "admin");
  assert.equal(normalizeRole("owner"), "owner");
  assert.equal(normalizeRole("field"), "field");
  assert.equal(normalizeRole(undefined), "admin");
});

test("field crew only access assigned jobs", () => {
  assert.equal(canAccessProject("field", "u1", { member_ids: ["u1"] }), true);
  assert.equal(canAccessProject("field", "u1", { member_ids: ["u2"] }), false);
  assert.equal(canAccessProject("admin", "u1", { member_ids: [] }), true);
});

test("only managers assign roles, never owner", () => {
  assert.deepEqual(assignableRoles("owner"), ["admin", "field"]);
  assert.deepEqual(assignableRoles("field"), []);
});
