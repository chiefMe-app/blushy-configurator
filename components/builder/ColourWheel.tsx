// Any colour of her own, after a row of swatches (2026-11-05, the owner: "textler için color wheel olsun"; then
// "tablesetup için söylediğim ayarları giveaways için de uygula"): a round "+" that opens the system colour picker,
// filled with her colour when it is one the row does not have.
export default function ColourWheel({ value, options, onPick, label, testId }: {
  value: string; options: string[]; onPick: (hex: string) => void; label: string; testId?: string;
}) {
  const hex = /^#[0-9a-f]{6}$/i.test(value);
  const own = hex && !options.some((h) => h.toUpperCase() === value.toUpperCase());
  return (
    <label className={`bz-ts-wheel ${own ? "on" : ""}`} title="Any colour" style={own ? { background: value } : undefined}>
      <span aria-hidden="true">+</span>
      <input type="color" aria-label={`${label}: any colour`} data-testid={testId}
        value={hex ? value.toLowerCase() : "#ffffff"} onChange={(e) => onPick(e.target.value.toUpperCase())} />
    </label>
  );
}
