import type { Location, Service } from "./types";

/**
 * Turns free text like "electricians in kingston" or "tilers clarendon"
 * into service + region filters, leaving any remainder as a name search.
 */
export function interpretSearch(q: string, services: Service[], regions: Location[]) {
  let rest = ` ${q.toLowerCase().replace(/[^a-z0-9\s&'-]/g, " ")} `;
  let service: Service | undefined;
  let region: Location | undefined;
  const byLength = <T,>(xs: T[], key: (x: T) => string[]) =>
    xs.flatMap((x) => key(x).map((k) => ({ x, k: k.toLowerCase() }))).sort((a, b) => b.k.length - a.k.length);
  for (const { x, k } of byLength(regions, (r) => [r.name, r.name.replace(/^st /i, "saint "), r.name.replace(/^st /i, "st. ")])) {
    if (rest.includes(` ${k} `)) { region = x; rest = rest.replace(` ${k} `, " "); break; }
  }
  for (const { x, k } of byLength(services, (s) => [s.plural_name, s.name, s.slug.replace(/-/g, " "), s.name.split(" ")[0] + "s"])) {
    if (k.length > 2 && rest.includes(` ${k} `)) { service = x; rest = rest.replace(` ${k} `, " "); break; }
  }
  const name = rest.replace(/\b(in|near|at|contractors?|services?|the)\b/g, " ").replace(/\s+/g, " ").trim();
  return { service, region, name };
}

