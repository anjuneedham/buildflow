import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretSearch } from "../src/lib/search.ts";
import type { Location, Service } from "../src/lib/types.ts";

const services = [
  { id: "s1", slug: "electrician", name: "Electrician", plural_name: "Electricians" },
  { id: "s2", slug: "mason", name: "Mason", plural_name: "Masons" },
  { id: "s3", slug: "tiler", name: "Tiler", plural_name: "Tilers" },
  { id: "s4", slug: "renovation", name: "Home Renovation", plural_name: "Home Renovation Contractors" },
] as Service[];
const regions = ["Kingston", "St Andrew", "Clarendon"].map((name, i) => ({ id: `r${i}`, name, slug: name.toLowerCase().replace(" ", "-"), level: "region", country_code: "JM", parent_id: null })) as Location[];

test("electricians in kingston", () => {
  const r = interpretSearch("Electricians in Kingston", services, regions);
  assert.equal(r.service?.id, "s1");
  assert.equal(r.region?.name, "Kingston");
  assert.equal(r.name, "");
});

test("masons in clarendon / tilers in st andrew", () => {
  assert.equal(interpretSearch("masons in clarendon", services, regions).service?.slug, "mason");
  const r = interpretSearch("Tilers in St Andrew", services, regions);
  assert.equal(r.service?.slug, "tiler");
  assert.equal(r.region?.name, "St Andrew");
});

test("multi-word service names", () => {
  assert.equal(interpretSearch("home renovation contractors", services, regions).service?.slug, "renovation");
});

test("leftover text becomes a name search", () => {
  const r = interpretSearch("island electrical", services, regions);
  assert.equal(r.service, undefined);
  assert.equal(r.name, "island electrical");
});
