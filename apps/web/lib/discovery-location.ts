/** Public display/filter aliases only. Original publisher fields remain in source snapshots. */
const aliases: Record<string, [string, string]> = {
  china: ["china", "China"],
  chinamainland: ["china", "China"],
  mainlandchina: ["china", "China"],
  hongkong: ["hongkong", "Hong Kong SAR"],
  hongkongsar: ["hongkong", "Hong Kong SAR"],
  hongkongsarchina: ["hongkong", "Hong Kong SAR"],
  macau: ["macao", "Macau SAR"],
  macao: ["macao", "Macau SAR"],
  macausar: ["macao", "Macau SAR"],
  macaosar: ["macao", "Macau SAR"],
  macausarchina: ["macao", "Macau SAR"],
  macaosarchina: ["macao", "Macau SAR"],
  nullmacausar: ["macao", "Macau SAR"],
  unitedstates: ["unitedstates", "United States"],
  unitedstatesofamerica: ["unitedstates", "United States"],
  usa: ["unitedstates", "United States"],
  uk: ["unitedkingdom", "United Kingdom"],
  unitedkingdom: ["unitedkingdom", "United Kingdom"],
  southkorea: ["southkorea", "South Korea"],
  republicofkorea: ["southkorea", "South Korea"],
  korearepublicof: ["southkorea", "South Korea"],
  russia: ["russia", "Russia"],
  russianfederation: ["russia", "Russia"],
  turkey: ["turkiye", "Türkiye"],
  türkiye: ["turkiye", "Türkiye"],
  turkiye: ["turkiye", "Türkiye"],
  czechrepublic: ["czechia", "Czechia"],
  czechia: ["czechia", "Czechia"],
  taiwan: ["taiwan", "Taiwan"],
  taiwanchina: ["taiwan", "Taiwan"],
};
function key(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}
export function countryKey(country: string) {
  return aliases[key(country)]?.[0] ?? key(country);
}
export function countryLabel(country: string) {
  return aliases[key(country)]?.[1] ?? country.trim();
}
export function formatDiscoveryLocation(region: string, country: string) {
  return [region.trim().replace(/[,，]+$/u, ""), countryLabel(country)]
    .filter(Boolean)
    .join(", ");
}
