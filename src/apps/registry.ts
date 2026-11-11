import type { IsCurrent } from "./chronocube/mode-switch.ts";
import type { ModeShell } from "./shell/slot-api.ts";

/** Landing-page section of the design proposal: featured modes are "apps", all others are "cubes". */
export const APP_GROUPS = ["apps", "cubes"] as const;
export type AppGroup = (typeof APP_GROUPS)[number];

/** What a mounted mode hands back so the host can remove it again. */
export interface ModeInstance {
  dispose(): void;
}

export interface MountContext {
  /** True while this mount is still the latest one; check it after every await. */
  isCurrent: IsCurrent;
  /**
   * The dock slots, status chip, primary action, readout and Nerd drawer of this mount. Writes after the mode was
   * replaced are dropped, and the router disposes it with the mode, so a mode never has to clear its own content.
   */
  shell: ModeShell;
}

/** Static description of a mode. Pure data, safe to import without a DOM. */
export interface ModeMeta {
  /** The single application key, used as `index.html?app=<id>`. */
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  cubes: number;
  group: AppGroup;
  /** Repository-relative path of the documentation page of this mode. */
  help: string;
  /**
   * Canonical keys (see PARAM_SPECS in param-specs.ts) of the setup parameters this mode owns. They are dropped from
   * the URL when the user switches to an app that does not own them. Global flags are not listed here.
   */
  params?: readonly string[];
}

/**
 * The mode contract: an id, a mount that receives the host element and the URL parameters, and a dispose through the
 * returned instance. A mount that returns nothing has nothing to dispose.
 */
export interface AppMode extends ModeMeta {
  mount(root: HTMLElement, params: URLSearchParams, ctx: MountContext): Promise<ModeInstance | void>;
}

export interface AppRegistry {
  ids(): string[];
  has(id: string): boolean;
  get(id: string): AppMode | undefined;
  list(group?: AppGroup): AppMode[];
}

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function assertMode(mode: AppMode): void {
  const where = `mode ${JSON.stringify(mode?.id)}`;
  if (typeof mode?.id !== "string" || !ID_PATTERN.test(mode.id)) throw new Error(`${where}: invalid id`);
  if (typeof mode.title !== "string" || mode.title === "") throw new Error(`${where}: missing title`);
  if (!APP_GROUPS.includes(mode.group)) throw new Error(`${where}: unknown group`);
  if (typeof mode.help !== "string" || mode.help === "") throw new Error(`${where}: missing help link`);
  if (typeof mode.mount !== "function") throw new Error(`${where}: missing mount`);
}

/** Builds an immutable registry keyed by the single `app` id. Throws on a duplicate id or a broken entry. */
export function createRegistry(modes: readonly AppMode[]): AppRegistry {
  const byId = new Map<string, AppMode>();
  for (const mode of modes) {
    assertMode(mode);
    if (byId.has(mode.id)) throw new Error(`duplicate mode id ${JSON.stringify(mode.id)}`);
    byId.set(mode.id, Object.freeze({ ...mode }));
  }
  return {
    ids: () => [...byId.keys()],
    has: (id) => byId.has(id),
    get: (id) => byId.get(id),
    list: (group) => [...byId.values()].filter((m) => !group || m.group === group),
  };
}
