import { MODE_CATALOG } from "./apps/mode-catalog.ts";
import { appHref, landingSections } from "./apps/landing/catalog.ts";

const $ = (id) => document.getElementById(id);

function tile(mode) {
  const a = document.createElement("a");
  a.className = "landing-tile";
  a.href = appHref(mode.id);
  a.dataset.app = mode.id;
  const name = document.createElement("span");
  name.className = "landing-tile-name";
  name.textContent = mode.title;
  const desc = document.createElement("span");
  desc.className = "landing-tile-desc";
  desc.textContent = mode.subtitle;
  const meta = document.createElement("span");
  meta.className = "landing-tile-meta";
  meta.textContent = `${mode.cubes} ${mode.cubes > 1 ? "cubes" : "cube"} · ${mode.badge}`;
  a.append(name, desc, meta);
  return a;
}

/** Fills the landing page: the tiles of the Apps and Cubes sections. */
export function showLanding() {
  const { hero, apps, cubes } = landingSections(MODE_CATALOG);
  $("landing-open-clock").href = appHref(hero.id);
  $("landing-apps").replaceChildren(...apps.map(tile));
  $("landing-cubes").replaceChildren(...cubes.map(tile));
}
