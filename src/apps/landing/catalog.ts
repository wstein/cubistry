import type { ModeMeta } from "../registry.ts";

/** The live clock is the hero of the landing page (design proposal: Live Clock on top). */
export const HERO_ID = "clock";

/** Link to one mode in the unified view. Relative, so it works under any base path and preview prefix. */
export function appHref(id: string): string {
  return `index.html?app=${encodeURIComponent(id)}`;
}

export interface LandingSections {
  hero: ModeMeta;
  /** Featured modes of the group `apps`, without the hero. */
  apps: ModeMeta[];
  /** The cube collection: every mode of the group `cubes`. */
  cubes: ModeMeta[];
}

/** Splits the catalog into the hero, the Apps section and the Cubes section of the landing page. */
export function landingSections(catalog: readonly ModeMeta[]): LandingSections {
  const hero = catalog.find((m) => m.id === HERO_ID);
  if (!hero) throw new Error(`the catalog has no ${HERO_ID} mode`);
  return {
    hero,
    apps: catalog.filter((m) => m.group === "apps" && m.id !== HERO_ID),
    cubes: catalog.filter((m) => m.group === "cubes"),
  };
}
