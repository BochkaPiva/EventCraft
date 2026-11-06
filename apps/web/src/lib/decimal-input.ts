export function parseDecimalInput(
  raw: string,
  places: number,
  maximum: number,
  minimum = 0,
): number | null | undefined {
  const text = raw.trim().replace(",", ".");
  if (!text) return null;
  if (
    text.length > 24 ||
    !new RegExp(`^\\d+(?:\\.\\d{0,${places}})?$`).test(text)
  )
    return undefined;
  const [whole, fraction = ""] = text.split(".");
  const value =
    BigInt(whole) * 10n ** BigInt(places) +
    BigInt(fraction.padEnd(places, "0"));
  if (value < BigInt(minimum) || value > BigInt(maximum)) return undefined;
  return Number(value);
}
export function formatDecimalInput(value: number | null, places: number) {
  if (value === null) return "";
  return (value / 10 ** places)
    .toFixed(places)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
}
