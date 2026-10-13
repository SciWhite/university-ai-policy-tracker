import type { SupportedLocale } from "./i18n";
const en = {
  academicIntegrity: "Academic integrity",
  teachingGuidance: "Teaching guidance",
  securityProcurement: "Security and procurement",

  revision: "Record revision",
  summaryState: "Student snapshot",
  held: "Awaiting independent review",
  strong: "Reviewed snapshot",
  baseline: "Current published baseline",
  pendingHarvard:
    "Harvard’s new review is awaiting acceptance. This preview uses the published baseline; it does not load the incomplete candidate.",
  analysis: "Grouped published claims",
  analysisNote:
    "These are interpretations of the current published claims, not an approved student snapshot. Read the conditions in each source.",
  topics: "Explore the current record by topic",
  more: "More reviewed record topics",
  gaps: "Evidence and review gaps",
  noGaps:
    "No held claims in this published record. This does not certify a complete university-policy audit.",
  claimCount: "Reviewed claims",
  heldClaims: "Held claims",
  versionNote:
    "A record check or retrieval date is not the university policy’s effective date.",
  scope: "Scope in cited claims",
  claimChecked: "Claim checked",
  retrieved: "Source retrieved",
  bodyScope:
    "Read the source-specific scope; course, unit and activity rules may differ.",
  topic: "Topic",
};
type Copy = typeof en;
const copies: Record<SupportedLocale, Copy> = {
  en,
  zh: {
    academicIntegrity: "学术诚信",
    teachingGuidance: "教学指导",
    securityProcurement: "安全与采购",

    revision: "记录修订版本",
    summaryState: "学生摘要",
    held: "独立复核待完成",
    strong: "已审核摘要",
    baseline: "当前公开基线",
    pendingHarvard:
      "哈佛新一轮复查尚待验收。本预览使用当前公开基线，不加载未完成的候选资料。",
    analysis: "按已发布主张分组",
    analysisNote:
      "以下是当前已发布主张的解读，不是已批准的学生摘要。请结合各来源中的条件阅读。",
    topics: "按主题查看新版记录",
    more: "更多已审核记录主题",
    gaps: "证据与复核缺口",
    noGaps: "本公开记录没有待审核主张；这不代表已完成全校政策的全量审计。",
    claimCount: "已审核主张",
    heldClaims: "待审核主张",
    versionNote: "记录核查日期、来源采集日期不等于大学政策的生效日期。",
    scope: "适用范围见引用主张",
    claimChecked: "主张核查日期",
    retrieved: "来源采集日期",
    bodyScope: "按各来源的适用范围阅读；课程、学院和活动的规则可能不同。",
    topic: "主题",
  },
  fr: {
    academicIntegrity: "Intégrité académique",
    teachingGuidance: "Conseils pédagogiques",
    securityProcurement: "Sécurité et acquisition",

    revision: "Révision du dossier",
    summaryState: "Résumé étudiant",
    held: "Examen indépendant en attente",
    strong: "Résumé examiné",
    baseline: "Base publique actuelle",
    pendingHarvard:
      "Le nouvel examen de Harvard attend une validation. Cet aperçu utilise la base publiée, pas le candidat incomplet.",
    analysis: "Affirmations publiées regroupées",
    analysisNote:
      "Interprétations des affirmations publiées actuelles, pas un résumé étudiant approuvé. Lisez les conditions de chaque source.",
    topics: "Explorer le dossier actuel par sujet",
    more: "Autres sujets du dossier examiné",
    gaps: "Lacunes des preuves et examens",
    noGaps:
      "Aucune affirmation en attente dans ce dossier publié. Cela ne certifie pas un audit complet des règles de l’université.",
    claimCount: "Affirmations examinées",
    heldClaims: "Affirmations en attente",
    versionNote:
      "La date de vérification ou de collecte n’est pas la date d’entrée en vigueur de la politique.",
    scope: "Portée dans les affirmations citées",
    claimChecked: "Affirmation vérifiée",
    retrieved: "Source collectée",
    bodyScope:
      "Lisez la portée de chaque source ; les règles des cours, unités et activités peuvent différer.",
    topic: "Sujet",
  },
  pl: {
    academicIntegrity: "Uczciwość akademicka",
    teachingGuidance: "Wskazówki dydaktyczne",
    securityProcurement: "Bezpieczeństwo i zakup",

    revision: "Wersja rekordu",
    summaryState: "Podsumowanie studenckie",
    held: "Oczekuje na niezależną weryfikację",
    strong: "Sprawdzone podsumowanie",
    baseline: "Aktualna opublikowana podstawa",
    pendingHarvard:
      "Nowy przegląd Harvardu oczekuje na akceptację. Podgląd korzysta z opublikowanej podstawy, a nie nieukończonego kandydata.",
    analysis: "Pogrupowane opublikowane twierdzenia",
    analysisNote:
      "Interpretacje aktualnych opublikowanych twierdzeń, nie zatwierdzone podsumowanie studenckie. Przeczytaj warunki w każdym źródle.",
    topics: "Aktualny rekord według tematów",
    more: "Więcej tematów sprawdzonego rekordu",
    gaps: "Luki dowodów i weryfikacji",
    noGaps:
      "Brak twierdzeń oczekujących na przegląd w tym opublikowanym rekordzie. Nie potwierdza to pełnego audytu zasad uczelni.",
    claimCount: "Sprawdzone twierdzenia",
    heldClaims: "Twierdzenia oczekujące",
    versionNote:
      "Data sprawdzenia rekordu lub pobrania źródła nie jest datą wejścia w życie zasad.",
    scope: "Zakres w cytowanych twierdzeniach",
    claimChecked: "Sprawdzenie twierdzenia",
    retrieved: "Pobranie źródła",
    bodyScope:
      "Czytaj zakres każdego źródła; zasady kursów, jednostek i działań mogą się różnić.",
    topic: "Temat",
  },
  es: {
    academicIntegrity: "Integridad académica",
    teachingGuidance: "Orientación docente",
    securityProcurement: "Seguridad y adquisición",

    revision: "Revisión del registro",
    summaryState: "Resumen estudiantil",
    held: "Revisión independiente pendiente",
    strong: "Resumen revisado",
    baseline: "Base publicada actual",
    pendingHarvard:
      "La nueva revisión de Harvard espera aceptación. Esta vista usa la base publicada, no el candidato incompleto.",
    analysis: "Afirmaciones publicadas agrupadas",
    analysisNote:
      "Interpretaciones de las afirmaciones publicadas actuales, no un resumen estudiantil aprobado. Lee las condiciones de cada fuente.",
    topics: "Explorar el registro actual por tema",
    more: "Más temas del registro revisado",
    gaps: "Lagunas de evidencia y revisión",
    noGaps:
      "No hay afirmaciones pendientes en este registro publicado. Esto no certifica una auditoría completa de las políticas universitarias.",
    claimCount: "Afirmaciones revisadas",
    heldClaims: "Afirmaciones pendientes",
    versionNote:
      "La fecha de verificación o recuperación no es la fecha de entrada en vigor de la política.",
    scope: "Alcance en las afirmaciones citadas",
    claimChecked: "Afirmación verificada",
    retrieved: "Fuente recuperada",
    bodyScope:
      "Lee el alcance de cada fuente; las normas de cursos, unidades y actividades pueden diferir.",
    topic: "Tema",
  },
  nl: {
    academicIntegrity: "Academische integriteit",
    teachingGuidance: "Onderwijsadvies",
    securityProcurement: "Beveiliging en inkoop",

    revision: "Recordrevisie",
    summaryState: "Studentenoverzicht",
    held: "Onafhankelijke beoordeling wacht",
    strong: "Beoordeeld overzicht",
    baseline: "Huidige gepubliceerde basis",
    pendingHarvard:
      "De nieuwe Harvard-beoordeling wacht op acceptatie. Deze preview gebruikt de gepubliceerde basis, niet de onvoltooide kandidaat.",
    analysis: "Gegroepeerde gepubliceerde claims",
    analysisNote:
      "Interpretaties van huidige gepubliceerde claims, geen goedgekeurd studentenoverzicht. Lees de voorwaarden in elke bron.",
    topics: "Huidig record per onderwerp",
    more: "Meer onderwerpen uit het beoordeelde record",
    gaps: "Hiaten in bewijs en beoordeling",
    noGaps:
      "Geen claims in afwachting in dit gepubliceerde record. Dit bevestigt geen volledige audit van het universiteitsbeleid.",
    claimCount: "Beoordeelde claims",
    heldClaims: "Claims in afwachting",
    versionNote:
      "De controle- of ophaaldatum is niet de ingangsdatum van het beleid.",
    scope: "Reikwijdte in geciteerde claims",
    claimChecked: "Claim gecontroleerd",
    retrieved: "Bron opgehaald",
    bodyScope:
      "Lees de reikwijdte per bron; cursus-, eenheids- en activiteitsregels kunnen verschillen.",
    topic: "Onderwerp",
  },
  ms: {
    academicIntegrity: "Integriti akademik",
    teachingGuidance: "Panduan pengajaran",
    securityProcurement: "Keselamatan dan perolehan",

    revision: "Semakan rekod",
    summaryState: "Ringkasan pelajar",
    held: "Menunggu semakan bebas",
    strong: "Ringkasan disemak",
    baseline: "Asas diterbitkan semasa",
    pendingHarvard:
      "Semakan baharu Harvard menunggu penerimaan. Pratonton ini menggunakan asas diterbitkan, bukan calon yang belum lengkap.",
    analysis: "Dakwaan diterbitkan dikumpulkan",
    analysisNote:
      "Tafsiran dakwaan diterbitkan semasa, bukan ringkasan pelajar yang diluluskan. Baca syarat setiap sumber.",
    topics: "Terokai rekod semasa mengikut topik",
    more: "Topik rekod disemak tambahan",
    gaps: "Jurang bukti dan semakan",
    noGaps:
      "Tiada dakwaan tertangguh dalam rekod diterbitkan ini. Ini tidak mengesahkan audit lengkap dasar universiti.",
    claimCount: "Dakwaan disemak",
    heldClaims: "Dakwaan tertangguh",
    versionNote:
      "Tarikh semakan atau pengambilan sumber bukan tarikh dasar berkuat kuasa.",
    scope: "Skop dalam dakwaan dipetik",
    claimChecked: "Dakwaan disemak",
    retrieved: "Sumber diambil",
    bodyScope:
      "Baca skop setiap sumber; peraturan kursus, unit dan aktiviti mungkin berbeza.",
    topic: "Topik",
  },
};
export const policyV6RecordCopy = (locale: SupportedLocale) => copies[locale];
