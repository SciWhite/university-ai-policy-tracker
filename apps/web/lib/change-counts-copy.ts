import type {ChangeEvent,ChangeItem} from "./change-events";
import {countChangeItems} from "./change-event-rules";
import {changeCategoryKeys,v6ChangesCopy} from "./v6-changes-copy";
import {SUPPORTED_LOCALES,type SupportedLocale} from "./i18n";
const labels={
  affected:["Records involved: {n}","涉及 {n} 条","Éléments concernés : {n}","Liczba objętych wpisów: {n}","Registros afectados: {n}","Betrokken gegevens: {n}","{n} rekod terlibat"],
  modified:["{n} corrected / adjusted","更正／调整 {n}","{n} corrigés / ajustés","Poprawiono / zmieniono: {n}","{n} corregidos / ajustados","{n} gecorrigeerd / aangepast","{n} dibetulkan / diselaraskan"],
  added:["{n} added","补录 {n}","{n} ajoutés","Dodano: {n}","{n} añadidos","{n} toegevoegd","{n} ditambah"],
  toolRecords:["{n} tool records","工具记录 {n}","{n} fiches d’outils","Wpisy narzędzi: {n}","{n} registros de herramientas","{n} toolgegevens","{n} rekod alat"],
  unnumberedRecords:["{n} unnumbered records","未编号记录 {n}","{n} fiches sans numéro","Wpisy bez numeru: {n}","{n} registros sin número","{n} ongenummerde gegevens","{n} rekod tanpa nombor"],
  unknown:["The historical item count could not be reconstructed.","历史条目数量无法还原。","Le nombre d’éléments historiques n’a pas pu être reconstitué.","Nie udało się odtworzyć liczby historycznych wpisów.","No se pudo reconstruir el número de registros históricos.","Het aantal historische gegevens kon niet worden gereconstrueerd.","Bilangan rekod sejarah tidak dapat dibina semula."],
  held:["{n} held","暂缓 {n}","{n} en attente","Wstrzymano: {n}","{n} pendientes","{n} aangehouden","{n} ditangguh"],
} as const;
export function changeCountsText(counts:ChangeEvent["counts"],locale:SupportedLocale){
  const i=SUPPORTED_LOCALES.indexOf(locale),format=(key:keyof typeof labels,n:number)=>labels[key][i].replace("{n}",String(n));
  const parts=(["modified","added","held","toolRecords","unnumberedRecords"] as const).flatMap(key=>counts[key]?[format(key,counts[key]!)]:[]);
  return format("affected",counts.affected)+(parts.length?` (${parts.join(" · ")})`:"");
}
export const changeItemCounts=countChangeItems;
/** A missing identity is an explicit history gap, never a fabricated Claim count. */
export function changeItemsText(items:ChangeItem[],locale:SupportedLocale){
  const counts=changeItemCounts(items);
  if(counts.affected)return changeCountsText(counts,locale);
  const copy=v6ChangesCopy(locale);
  const categories=[...new Set(items.map(item=>copy.categories[changeCategoryKeys.indexOf(item.category)]??copy.other))].join(" · ");
  return categories+(items.some(item=>!["source_update","page_update","record_maintenance"].includes(item.category))?` · ${labels.unknown[SUPPORTED_LOCALES.indexOf(locale)]}`:"");
}
