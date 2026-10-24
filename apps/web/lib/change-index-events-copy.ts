import {SUPPORTED_LOCALES,type SupportedLocale} from "./i18n";
const text={
  title:["Record updates","记录更新","Mises à jour du registre","Aktualizacje rejestru","Actualizaciones del registro","Registerupdates","Kemas kini rekod"],
  search:["Search universities or revisions","搜索学校或修订版本","Rechercher une université ou une révision","Szukaj uczelni lub wersji","Buscar universidades o revisiones","Universiteiten of revisies zoeken","Cari universiti atau semakan"],
  country:["Country / region","国家／地区","Pays / région","Kraj / region","País / región","Land / regio","Negara / wilayah"],
  allCountries:["All countries / regions","全部国家／地区","Tous les pays / régions","Wszystkie kraje / regiony","Todos los países / regiones","Alle landen / regio’s","Semua negara / wilayah"],
  schools:["Universities: {n}","涉及学校：{n} 所","Universités : {n}","Uczelnie: {n}","Universidades: {n}","Universiteiten: {n}","Universiti: {n}"],
  loading:["Loading matching updates…","正在读取匹配记录…","Chargement des mises à jour…","Wczytywanie aktualizacji…","Cargando actualizaciones…","Updates laden…","Memuatkan kemas kini…"],
  choose:["Choose a revision to read its details.","选择一条修订查看详情。","Choisissez une révision pour voir les détails.","Wybierz wersję, aby zobaczyć szczegóły.","Elige una revisión para ver sus detalles.","Kies een revisie om de details te bekijken.","Pilih semakan untuk melihat butiran."],
  indexJson:["Event index JSON","事件索引 JSON","Index des événements JSON","Indeks zdarzeń JSON","Índice de eventos JSON","Gebeurtenissenindex JSON","Indeks peristiwa JSON"],
  latestJson:["Latest revision per university JSON","各校最近修订 JSON","Dernière révision par université JSON","Ostatnia wersja każdej uczelni JSON","Última revisión por universidad JSON","Laatste revisie per universiteit JSON","Semakan terkini setiap universiti JSON"],
  recentJson:["Recent recorded events JSON","最近记录事件 JSON","Événements récents JSON","Ostatnie zdarzenia JSON","Eventos recientes JSON","Recente gebeurtenissen JSON","Peristiwa terkini JSON"],
  rss:["RSS feed","RSS 订阅","Flux RSS","Kanał RSS","Canal RSS","RSS-feed","Suapan RSS"],
  items:["Affected records in this revision: {n}","本次修订涉及记录：{n} 条","Éléments concernés par cette révision : {n}","Wpisy objęte tą wersją: {n}","Registros afectados en esta revisión: {n}","Betrokken gegevens in deze revisie: {n}","Rekod terlibat dalam semakan ini: {n}"],
  admissions:["Admissions","招生","Admissions","Rekrutacja","Admisiones","Toelating","Kemasukan"],
  applications:["Applications","申请材料","Candidatures","Materiały aplikacyjne","Solicitudes","Aanvragen","Permohonan"],
  scope:["Revisions to this site's records do not establish that a university changed its policy.","这里记录本站资料的修订，不代表学校发布了新政策。","Les révisions des données du site ne confirment pas un changement de politique de l’université.","Zmiany wpisów serwisu nie potwierdzają zmiany zasad uczelni.","Las revisiones de los registros del sitio no confirman cambios en la política de la universidad.","Revisies van onze gegevens bevestigen geen beleidswijziging van de universiteit.","Semakan rekod laman ini tidak mengesahkan perubahan dasar universiti."],
} as const;
export function changeIndexEventsCopy(locale:SupportedLocale){const index=SUPPORTED_LOCALES.indexOf(locale);return Object.fromEntries(Object.entries(text).map(([key,values])=>[key,values[index]])) as Record<keyof typeof text,string>;}
