import {SUPPORTED_LOCALES,type SupportedLocale} from "./i18n";
const text={
  history:["Record history","记录修订历史","Historique du registre","Historia rejestru","Historial del registro","Registergeschiedenis","Sejarah rekod"],
  revision:["Record revision","记录修订","Révision du registre","Wersja rejestru","Revisión del registro","Registerrevisie","Semakan rekod"],
  allDates:["All recorded history","全部可查历史","Tout l’historique disponible","Cała dostępna historia","Todo el historial disponible","Alle beschikbare geschiedenis","Semua sejarah tersedia"],
  range:["Date range","日期范围","Période","Zakres dat","Intervalo de fechas","Datumbereik","Julat tarikh"],
  type:["Update type","更新类型","Type de mise à jour","Rodzaj aktualizacji","Tipo de actualización","Soort update","Jenis kemas kini"],
  topic:["Topic or recorded category","主题或原有分类","Thème ou catégorie enregistrée","Temat lub zapisana kategoria","Tema o categoría registrada","Onderwerp of vastgelegde categorie","Topik atau kategori direkodkan"],
  defaultTypes:["Record updates (default)","记录更新（默认）","Mises à jour du registre (par défaut)","Aktualizacje rejestru (domyślnie)","Actualizaciones del registro (predeterminado)","Registerupdates (standaard)","Kemas kini rekod (lalai)"],
  allTypes:["All update types","全部更新类型","Tous les types","Wszystkie rodzaje","Todos los tipos","Alle soorten","Semua jenis"],
  allTopics:["All topics and categories","全部主题与分类","Tous les thèmes et catégories","Wszystkie tematy i kategorie","Todos los temas y categorías","Alle onderwerpen en categorieën","Semua topik dan kategori"],
  matches:["Matching revisions: {n}","匹配修订：{n} 次","Révisions correspondantes : {n}","Pasujące wersje: {n}","Revisiones coincidentes: {n}","Overeenkomende revisies: {n}","Semakan sepadan: {n}"],
  previous:["Previous page","上一页","Page précédente","Poprzednia strona","Página anterior","Vorige pagina","Halaman sebelumnya"],
  next:["Next page","下一页","Page suivante","Następna strona","Página siguiente","Volgende pagina","Halaman seterusnya"],
  page:["Page {n} of {m}","第 {n} / {m} 页","Page {n} sur {m}","Strona {n} z {m}","Página {n} de {m}","Pagina {n} van {m}","Halaman {n} daripada {m}"],
  university:["University page","学校页面","Page de l’université","Strona uczelni","Página de la universidad","Universiteitspagina","Halaman universiti"],
  json:["History JSON","历史 JSON","Historique JSON","Historia JSON","Historial JSON","Geschiedenis-JSON","JSON sejarah"],
  reason:["Historical reasons remain unclassified when the record does not specify them.","历史记录未注明原因时，保留为原因未分类。","Les motifs historiques non précisés restent non classés.","Niepodane powody historyczne pozostają niesklasyfikowane.","Los motivos históricos no especificados permanecen sin clasificar.","Niet vermelde historische redenen blijven ongeclassificeerd.","Sebab sejarah yang tidak dinyatakan kekal tidak dikelaskan."],
  revisionId:["Revision","修订版本","Révision","Wersja","Revisión","Revisie","Semakan"],
  prior:["Previous recorded revision","前一记录修订","Révision précédente enregistrée","Poprzednia zapisana wersja","Revisión anterior registrada","Vorige vastgelegde revisie","Semakan terdahulu direkodkan"],
  scope:["Tracker publication time is not a university policy effective date.","本站发布时间不等于学校政策生效时间。","La date de publication du registre n’est pas la date d’entrée en vigueur de la politique.","Data publikacji rejestru nie jest datą wejścia w życie zasad uczelni.","La fecha de publicación del registro no es la fecha de entrada en vigor de la política.","De publicatiedatum van het register is geen ingangsdatum van universitair beleid.","Tarikh penerbitan rekod bukan tarikh kuat kuasa dasar universiti."],
} as const;
export function changeHistoryCopy(locale:SupportedLocale){const index=SUPPORTED_LOCALES.indexOf(locale);return Object.fromEntries(Object.entries(text).map(([key,values])=>[key,values[index]])) as Record<keyof typeof text,string>;}
