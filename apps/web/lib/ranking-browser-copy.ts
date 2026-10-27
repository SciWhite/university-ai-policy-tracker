import type { SupportedLocale } from "./i18n";
const en = {
  system: "Ranking system",
  edition: "Edition",
  size: "Per page",
  first: "First",
  last: "Last",
  jump: "Go to page",
  go: "Go",
  scope: "Record type",
  all: "All records",
  policy: "Policy indexed",
  only: "Ranking only",
  pending: "Identity review pending",
  noPolicy: "No linked policy record",
  source: "Official ranking source",
  back: "Back to results",
  rankings: "Browse rankings",
  directory: "University directory",
  linked: "Linked to catalog",
  rows: "ranking records",
  recordNote:
    "Directory includes every policy catalog identity plus unlinked source records from the selected edition. Source records are not a global distinct-university count.",
  rankingNote:
    "Rankings describe institutions, not AI policy quality. Policy review dates and held decisions are unchanged.",
  qsNote:
    "Partial historical snapshot: 857 scattered rows, including 1401+. It is neither a continuous top 857 nor a complete top 1000.",
  oldNote:
    "Historical snapshot: first 1,000 source rows. Coverage outside this snapshot is unknown.",
  cwtsNote:
    "Derived order of the captured configurable CWTS metric view; not an overall world rank.",
  unranked: "Reporter / Unranked entries excluded from numerical ranks",
  resetPage: "Back to first page",
  unknownCountry: "Location not supplied",
  results: "results",
  review: "Policy review",
  notice: "Coverage and sources",
  range: "Bands retain their official bounds; ties keep the publisher’s rank.",
};
type Copy = typeof en;
const zh: Copy = {
  system: "排名体系",
  edition: "版本",
  size: "每页条数",
  first: "首页",
  last: "末页",
  jump: "跳转页码",
  go: "跳转",
  scope: "记录类型",
  all: "全部记录",
  policy: "已收录政策",
  only: "仅榜单记录",
  pending: "身份待核对",
  noPolicy: "未关联政策记录",
  source: "官方排名来源",
  back: "返回原列表",
  rankings: "浏览排名",
  directory: "大学目录",
  linked: "已关联目录",
  rows: "条排名记录",
  recordNote:
    "目录保留全部政策学校，并列出所选版本未关联的来源记录。来源记录数不代表全球去重大学数。",
  rankingNote:
    "排名展示学校信息，不评价 AI 政策质量。政策核查日期与暂缓决定保持原值。",
  qsNote:
    "不完整历史快照：857 条跨分页记录，含 1401+。不是连续前 857 名，也不是完整前 1000。",
  oldNote: "历史快照：前 1000 条来源记录。快照范围以外的收录情况未知。",
  cwtsNote: "CWTS 可配置指标视图的派生顺序，不是综合世界名次。",
  unranked: "Reporter／Unranked 未计入正式名次",
  resetPage: "回到第一页",
  unknownCountry: "来源未提供地区",
  results: "条结果",
  review: "政策核查",
  notice: "收录范围与来源",
  range: "区间保留官方上下界，并列保留出版方名次。",
};
const translations: Record<
  Exclude<SupportedLocale, "en" | "zh">,
  Partial<Copy>
> = {
  fr: {
    system: "Système de classement",
    edition: "Édition",
    size: "Par page",
    first: "Première",
    last: "Dernière",
    jump: "Aller à la page",
    go: "Aller",
    scope: "Type de dossier",
    all: "Tous les dossiers",
    policy: "Politique indexée",
    only: "Classement uniquement",
    pending: "Identité à vérifier",
    noPolicy: "Aucune politique liée",
    source: "Source officielle du classement",
    back: "Retour aux résultats",
    rankings: "Parcourir les classements",
    directory: "Annuaire universitaire",
    linked: "Liés au catalogue",
    rows: "entrées de classement",
    resetPage: "Retour à la première page",
    unknownCountry: "Lieu non fourni",
    results: "résultats",
    review: "Vérification de la politique",
    notice: "Couverture et sources",
    recordNote:
      "Toutes les identités du catalogue sont conservées. Les entrées non liées de cette édition restent distinctes ; leur nombre n’est pas un total mondial dédupliqué.",
    rankingNote:
      "Le classement ne mesure pas la qualité des politiques IA. Dates de vérification et décisions suspendues inchangées.",
    qsNote:
      "Instantané historique incomplet : 857 lignes dispersées, dont 1401+. Ni les 857 premiers, ni un top 1000 complet.",
    oldNote:
      "Instantané historique : 1 000 premières lignes. Couverture inconnue au-delà.",
    cwtsNote:
      "Ordre dérivé d’un indicateur CWTS configurable, pas un classement mondial général.",
    unranked: "Reporter / Unranked exclus des rangs numériques",
    range: "Les intervalles et ex æquo conservent les rangs officiels.",
  },
  pl: {
    system: "System rankingowy",
    edition: "Edycja",
    size: "Na stronę",
    first: "Pierwsza",
    last: "Ostatnia",
    jump: "Przejdź do strony",
    go: "Przejdź",
    scope: "Typ rekordu",
    all: "Wszystkie rekordy",
    policy: "Polityka w katalogu",
    only: "Tylko ranking",
    pending: "Tożsamość do weryfikacji",
    noPolicy: "Brak powiązanej polityki",
    source: "Oficjalne źródło rankingu",
    back: "Wróć do wyników",
    rankings: "Przeglądaj rankingi",
    directory: "Katalog uczelni",
    linked: "Powiązane z katalogiem",
    rows: "rekordów rankingu",
    resetPage: "Wróć na pierwszą stronę",
    unknownCountry: "Brak lokalizacji",
    results: "wyników",
    review: "Weryfikacja polityki",
    notice: "Zakres i źródła",
    recordNote:
      "Katalog zachowuje wszystkie tożsamości z politykami oraz niepowiązane rekordy wybranej edycji. To nie jest globalna liczba unikalnych uczelni.",
    rankingNote:
      "Ranking nie ocenia jakości polityk AI. Daty kontroli i decyzje wstrzymane pozostają bez zmian.",
    qsNote:
      "Niepełny zrzut historyczny: 857 rozproszonych rekordów, w tym 1401+. To nie jest ciągłe top 857 ani pełne top 1000.",
    oldNote:
      "Zrzut historyczny: pierwsze 1000 rekordów. Dalszy zakres nieznany.",
    cwtsNote:
      "Kolejność pochodna konfigurowalnej miary CWTS, a nie ogólny ranking światowy.",
    unranked: "Reporter / Unranked poza rankingiem liczbowym",
    range: "Przedziały i remisy zachowują oficjalne pozycje.",
  },
  es: {
    system: "Sistema de clasificación",
    edition: "Edición",
    size: "Por página",
    first: "Primera",
    last: "Última",
    jump: "Ir a la página",
    go: "Ir",
    scope: "Tipo de registro",
    all: "Todos los registros",
    policy: "Política indexada",
    only: "Solo clasificación",
    pending: "Identidad por revisar",
    noPolicy: "Sin política vinculada",
    source: "Fuente oficial",
    back: "Volver a los resultados",
    rankings: "Explorar clasificaciones",
    directory: "Directorio universitario",
    linked: "Vinculados al catálogo",
    rows: "registros de clasificación",
    resetPage: "Volver a la primera página",
    unknownCountry: "Ubicación no facilitada",
    results: "resultados",
    review: "Revisión de políticas",
    notice: "Cobertura y fuentes",
    recordNote:
      "Se conservan todas las identidades del catálogo y los registros sin vincular de esta edición. No es un total mundial de universidades únicas.",
    rankingNote:
      "La clasificación no evalúa las políticas de IA. Las fechas de revisión y decisiones pendientes no cambian.",
    qsNote:
      "Captura histórica parcial: 857 filas dispersas, incluidas 1401+. No es un top 857 continuo ni un top 1000 completo.",
    oldNote:
      "Captura histórica: primeras 1000 filas. Se desconoce la cobertura posterior.",
    cwtsNote:
      "Orden derivado de una métrica configurable de CWTS, no una clasificación mundial general.",
    unranked: "Reporter / Unranked excluidos de los rangos numéricos",
    range: "Los intervalos y empates conservan los rangos oficiales.",
  },
  nl: {
    system: "Ranglijstsysteem",
    edition: "Editie",
    size: "Per pagina",
    first: "Eerste",
    last: "Laatste",
    jump: "Ga naar pagina",
    go: "Ga",
    scope: "Recordtype",
    all: "Alle records",
    policy: "Beleid geïndexeerd",
    only: "Alleen ranglijst",
    pending: "Identiteit nog te controleren",
    noPolicy: "Geen gekoppeld beleidsrecord",
    source: "Officiële ranglijstbron",
    back: "Terug naar resultaten",
    rankings: "Ranglijsten bekijken",
    directory: "Universiteitsgids",
    linked: "Gekoppeld aan catalogus",
    rows: "ranglijstrecords",
    resetPage: "Terug naar eerste pagina",
    unknownCountry: "Locatie niet vermeld",
    results: "resultaten",
    review: "Beleidscontrole",
    notice: "Dekking en bronnen",
    recordNote:
      "Alle catalogusidentiteiten en ongekoppelde bronrecords van deze editie blijven behouden. Dit is geen wereldwijd ontdubbeld aantal universiteiten.",
    rankingNote:
      "De ranglijst beoordeelt geen AI-beleid. Controledatums en aangehouden beslissingen blijven ongewijzigd.",
    qsNote:
      "Onvolledige historische momentopname: 857 verspreide rijen, inclusief 1401+. Geen aaneengesloten top 857 of volledige top 1000.",
    oldNote:
      "Historische momentopname: eerste 1000 bronrijen. Verdere dekking onbekend.",
    cwtsNote:
      "Afgeleide volgorde van een instelbare CWTS-maatstaf, geen algemene wereldranglijst.",
    unranked: "Reporter / Unranked uitgesloten van numerieke ranglijst",
    range: "Intervallen en gelijke posities behouden de officiële rangen.",
  },
  ms: {
    system: "Sistem kedudukan",
    edition: "Edisi",
    size: "Setiap halaman",
    first: "Pertama",
    last: "Terakhir",
    jump: "Ke halaman",
    go: "Pergi",
    scope: "Jenis rekod",
    all: "Semua rekod",
    policy: "Dasar diindeks",
    only: "Kedudukan sahaja",
    pending: "Identiti menunggu semakan",
    noPolicy: "Tiada rekod dasar dipautkan",
    source: "Sumber kedudukan rasmi",
    back: "Kembali ke hasil",
    rankings: "Lihat kedudukan",
    directory: "Direktori universiti",
    linked: "Dipautkan ke katalog",
    rows: "rekod kedudukan",
    resetPage: "Kembali ke halaman pertama",
    unknownCountry: "Lokasi tidak diberikan",
    results: "hasil",
    review: "Semakan dasar",
    notice: "Liputan dan sumber",
    recordNote:
      "Semua identiti katalog dikekalkan bersama rekod sumber edisi ini yang belum dipautkan. Ini bukan bilangan universiti unik sedunia.",
    rankingNote:
      "Kedudukan tidak menilai kualiti dasar AI. Tarikh semakan dan keputusan tertangguh tidak berubah.",
    qsNote:
      "Petikan sejarah tidak lengkap: 857 baris tersebar, termasuk 1401+. Bukan 857 teratas berturutan atau 1000 teratas lengkap.",
    oldNote:
      "Petikan sejarah: 1000 baris sumber pertama. Liputan seterusnya tidak diketahui.",
    cwtsNote:
      "Susunan terbitan metrik CWTS boleh laras, bukan kedudukan dunia keseluruhan.",
    unranked: "Reporter / Unranked tidak dikira sebagai kedudukan bernombor",
    range: "Julat dan seri mengekalkan kedudukan rasmi.",
  },
};
export function rankingBrowserCopy(locale: SupportedLocale): Copy {
  return locale === "en"
    ? en
    : locale === "zh"
      ? zh
      : { ...en, ...translations[locale] };
}
