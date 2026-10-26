// Step 2 · Theme, moved unchanged from app/builder/page.tsx (Phase 0.1c).
import { themeById, type BuilderConfig, type ThemeId, type Theme } from "@/lib/config";
import { THEME_GROUPS } from "@/components/builder/constants";

export default function ThemeStep({ config, theme, themeGroup, setTheme, setThemeGroup }: {
  config: BuilderConfig;
  theme: Theme;
  /** Which list the theme was picked from, so Space (in both) ticks only there. */
  themeGroup: "girl" | "boy" | null;
  setTheme: (id: ThemeId) => void;
  setThemeGroup: (g: "girl" | "boy" | null) => void;
}) {
  return (
    <div>
      <h2 className="bz-world-title">Choose your party world</h2>
      {THEME_GROUPS.map((g) => (
      <div key={g.key} className={`bz-theme-group ${g.key}`}>
      <h3 className="bz-theme-group-head">{g.title}</h3>
      <div className="bz-theme-grid four">
        {g.items.map(({ id, icon }) => {
          const t = themeById(id);
          if (!t) return null;
          const inBoth = THEME_GROUPS.every((gg) => gg.items.some((it) => it.id === id));
          const sel = config.themeSelected && config.theme === t.id && (!inBoth || themeGroup === null || themeGroup === g.key);
          return (
            <button key={t.id} type="button" onClick={() => { setTheme(t.id); setThemeGroup(g.key); }} aria-pressed={sel}
              className={`bz-choice bz-theme ${sel ? "selected" : ""}`}>
              {sel && <span className="tick">✓</span>}
              <span className="art">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/design/themes-v2/${icon}.webp`} alt="" loading="lazy" />
              </span>
              <h3>{t.name}</h3>
              {/* The theme's real Sempertex balloon colours — product data. */}
              {t.balloonColors.length > 0 && (
                <span className="palette" aria-hidden="true">
                  {t.balloonColors.slice(0, 5).map((c, i) => <i key={i} style={{ background: c }} />)}
                </span>
              )}
              <small className={`cost ${t.priceModifier > 0 ? "" : "included"}`}>
                {t.priceModifier > 0 ? `+AED ${t.priceModifier}` : "Included"}
              </small>
            </button>
          );
        })}
      </div>
      </div>
      ))}
      <div className="bz-help">
        {config.themeSelected
          ? <>✨ <strong>{theme.name} selected!</strong> Tap any icon to switch themes.</>
          : <>✦ <strong>Choose a theme to continue.</strong> You can change it anytime.</>}
      </div>
    </div>
  );
}
