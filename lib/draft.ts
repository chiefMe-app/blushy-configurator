// The builder design kept on the customer's own device (localStorage), so a
// reload or a return visit opens where they left off. Only design choices are
// stored: never the customer's name, phone or venue. Anything that does not
// read back as a sensible design is ignored, never trusted.
import { THEMES, defaultConfig, servicePackageById, themeById, type BuilderConfig } from "@/lib/config";
import { readTableSetup } from "@/lib/studio/tableSetup";

export const DRAFT_KEY = "partymuse.builder.draft.v1";
const LAST_STEP = 6;
const LAST_DECOR_TAB = 3;

type DesignFields = Pick<BuilderConfig, "eventType" | "theme" | "themeSelected" | "package" | "servicePackageId" | "decor" | "table" | "addOns">;

export interface StoredDraft {
  v: 1;
  savedAt: string;
  step: number;
  decorTab: number;
  config: DesignFields;
}

export interface RestoredDraft {
  config: BuilderConfig;
  step: number;
  decorTab: number;
}

/** True once the customer has chosen something worth keeping. */
export function isWorthSaving(config: BuilderConfig, step: number): boolean {
  return config.themeSelected || step > 0;
}

export function toDraft(config: BuilderConfig, step: number, decorTab: number, now = new Date()): StoredDraft {
  const { eventType, theme, themeSelected, package: pkg, servicePackageId, decor, table, addOns } = config;
  return {
    v: 1,
    savedAt: now.toISOString(),
    step,
    decorTab,
    config: { eventType, theme, themeSelected, package: pkg, servicePackageId, decor, ...(table ? { table } : {}), addOns },
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const clampInt = (v: unknown, max: number) => (Number.isInteger(v) ? Math.max(0, Math.min(max, v as number)) : 0);

/** The saved design laid over today's defaults, or null if there is none or it is unusable. */
export function fromDraft(raw: string | null): RestoredDraft | null {
  if (!raw) return null;
  let d: unknown;
  try { d = JSON.parse(raw); } catch { return null; }
  if (!isObject(d) || d.v !== 1 || !isObject(d.config)) return null;
  const c = d.config;
  if (!isObject(c.decor) || !Array.isArray(c.decor.backdropItems) || !Array.isArray(c.addOns)) return null;
  if (typeof c.theme !== "string" || !themeById(c.theme as BuilderConfig["theme"])) return null;
  const base = defaultConfig();
  const config: BuilderConfig = {
    ...base,
    eventType: typeof c.eventType === "string" ? (c.eventType as BuilderConfig["eventType"]) : base.eventType,
    theme: c.theme as BuilderConfig["theme"],
    themeSelected: c.themeSelected === true,
    package: typeof c.package === "string" ? (c.package as BuilderConfig["package"]) : base.package,
    servicePackageId: typeof c.servicePackageId === "string" && servicePackageById(c.servicePackageId as BuilderConfig["servicePackageId"])
      ? (c.servicePackageId as BuilderConfig["servicePackageId"]) : base.servicePackageId,
    decor: { ...base.decor, ...(c.decor as Partial<BuilderConfig["decor"]>) },
    addOns: c.addOns as BuilderConfig["addOns"],
  };
  const table = readTableSetup(c.table, themeById(config.theme) ?? THEMES[0]);
  if (table) config.table = table;
  // Past the Theme step only with a theme chosen.
  const step = config.themeSelected ? clampInt(d.step, LAST_STEP) : Math.min(clampInt(d.step, LAST_STEP), 1);
  return { config, step, decorTab: clampInt(d.decorTab, LAST_DECOR_TAB) };
}
