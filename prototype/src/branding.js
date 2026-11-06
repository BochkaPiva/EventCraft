export function brandStyle(color) {
  const accent = /^#[0-9a-f]{6}$/i.test(color || "") ? color : "#4f46e5";
  const rgb = [1, 3, 5]
    .map((i) => parseInt(accent.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const light = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return {
    "--brand": accent,
    "--brand-on": light > 0.179 ? "#000" : "#fff",
    "--brand-text": 1.05 / (light + 0.05) >= 4.5 ? accent : "#17202e",
  };
}
