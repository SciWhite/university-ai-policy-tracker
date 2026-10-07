import type { SupportedLocale } from "@/lib/i18n";
import { translateSurfaceText } from "@/lib/surface-localization";

// Interface translations only. Native policy prose and original evidence stay unchanged.
const languages = ["zh", "fr", "pl", "es", "nl", "ms"] as const;
export const policyReferenceUi = {
  "Site interpretation; official evidence remains in its original language.": ["本站解读；官方证据保留原文。", "Interprétation du site ; les preuves officielles restent dans leur langue d’origine.", "Interpretacja serwisu; oficjalne dowody pozostają w języku oryginału.", "Interpretación del sitio; la evidencia oficial se conserva en su idioma original.", "Interpretatie van deze site; officieel bewijs blijft in de oorspronkelijke taal.", "Tafsiran laman; bukti rasmi kekal dalam bahasa asal."],
  "More policy information": ["更多政策信息", "Informations complémentaires sur les règles", "Dodatkowe informacje o zasadach", "Más información sobre las normas", "Meer beleidsinformatie", "Maklumat dasar tambahan"],
  "Source check and dated evidence": [
    "来源核查与历史证据", "Vérification des sources et preuves datées", "Kontrola źródeł i datowane dowody", "Comprobación de fuentes y evidencia fechada", "Broncontrole en gedateerd bewijs", "Semakan sumber dan bukti bertarikh"
  ],
  "On this page": [
    "本页目录",
    "Sur cette page",
    "Na tej stronie",
    "En esta página",
    "Op deze pagina",
    "Pada halaman ini"
  ],
  "At a glance": [
    "政策速览",
    "En bref",
    "W skrócie",
    "De un vistazo",
    "In één oogopslag",
    "Sepintas lalu"
  ],
  "Coursework": [
    "课程作业",
    "Travaux de cours",
    "Prace zaliczeniowe",
    "Trabajos del curso",
    "Cursusopdrachten",
    "Kerja kursus"
  ],
  "Exams": [
    "考试",
    "Examens",
    "Egzaminy",
    "Exámenes",
    "Examens",
    "Peperiksaan"
  ],
  "Disclosure": [
    "使用披露",
    "Déclaration d’utilisation",
    "Ujawnienie użycia",
    "Declaración de uso",
    "Vermelding van gebruik",
    "Pengisytiharan penggunaan"
  ],
  "Data safety": [
    "数据安全",
    "Sécurité des données",
    "Bezpieczeństwo danych",
    "Seguridad de los datos",
    "Gegevensveiligheid",
    "Keselamatan data"
  ],
  "Approved tools": [
    "获准工具",
    "Outils autorisés",
    "Zatwierdzone narzędzia",
    "Herramientas autorizadas",
    "Goedgekeurde hulpmiddelen",
    "Alat yang diluluskan"
  ],
  "Reviewed claims": [
    "已审核条款",
    "Énoncés examinés",
    "Zweryfikowane stwierdzenia",
    "Afirmaciones revisadas",
    "Beoordeelde uitspraken",
    "Pernyataan yang disemak"
  ],
  "Official sources": [
    "官方来源",
    "Sources officielles",
    "Oficjalne źródła",
    "Fuentes oficiales",
    "Officiële bronnen",
    "Sumber rasmi"
  ],
  "About this record": [
    "关于此记录",
    "À propos de cette fiche",
    "O tym wpisie",
    "Acerca de este registro",
    "Over dit dossier",
    "Tentang rekod ini"
  ],
  "Do": [
    "建议做",
    "À faire",
    "Co robić",
    "Qué hacer",
    "Wel doen",
    "Perkara yang perlu dilakukan"
  ],
  "Don't": [
    "应避免",
    "À éviter",
    "Czego unikać",
    "Qué evitar",
    "Niet doen",
    "Perkara yang perlu dielakkan"
  ],
  "Explore the policy by topic": [
    "按主题查看政策",
    "Explorer la politique par thème",
    "Przeglądaj zasady według tematu",
    "Explorar la política por tema",
    "Bekijk het beleid per onderwerp",
    "Terokai dasar mengikut topik"
  ],
  "Check the rule for your school and assignment.": [
    "请核对所在学院及具体作业的规定。",
    "Vérifiez les règles de votre école et de votre devoir.",
    "Sprawdź zasady swojej szkoły i danego zadania.",
    "Consulta las normas de tu facultad y de la tarea.",
    "Controleer de regels van je faculteit en opdracht.",
    "Semak peraturan fakulti dan tugasan anda."
  ],
  "Policy guidance below is in English; official evidence remains in its original language.": [
    "以下政策指南保留英文；官方证据保留原文。",
    "Le guide ci-dessous est en anglais ; les preuves officielles restent dans leur langue d’origine.",
    "Poniższe wskazówki są po angielsku; oficjalne dowody zachowano w języku oryginału.",
    "La guía siguiente está en inglés; las pruebas oficiales conservan su idioma original.",
    "De onderstaande richtlijnen zijn in het Engels; officiële bewijsstukken behouden hun oorspronkelijke taal.",
    "Panduan dasar di bawah adalah dalam bahasa Inggeris; bukti rasmi dikekalkan dalam bahasa asal."
  ],
  "Coursework & assignments": [
    "课程与作业",
    "Cours et devoirs",
    "Zajęcia i zadania",
    "Cursos y tareas",
    "Cursussen en opdrachten",
    "Kerja kursus dan tugasan"
  ],
  "Exams & assessment": [
    "考试与评估",
    "Examens et évaluations",
    "Egzaminy i ocenianie",
    "Exámenes y evaluación",
    "Examens en beoordeling",
    "Peperiksaan dan penilaian"
  ],
  "Disclosure & citation": [
    "使用披露与引用",
    "Déclaration et citation",
    "Ujawnienie i cytowanie",
    "Declaración y citas",
    "Vermelding en bronverwijzing",
    "Pengisytiharan dan petikan"
  ],
  "Privacy & sensitive data": [
    "隐私与敏感数据",
    "Confidentialité et données sensibles",
    "Prywatność i dane wrażliwe",
    "Privacidad y datos sensibles",
    "Privacy en gevoelige gegevens",
    "Privasi dan data sensitif"
  ],
  "University-provided AI tools": [
    "大学提供的 AI 工具",
    "Outils d’IA fournis par l’université",
    "Narzędzia AI udostępniane przez uczelnię",
    "Herramientas de IA de la universidad",
    "AI-hulpmiddelen van de universiteit",
    "Alat AI yang disediakan universiti"
  ],
  "Research & publication": [
    "研究与发表",
    "Recherche et publication",
    "Badania i publikacje",
    "Investigación y publicación",
    "Onderzoek en publicatie",
    "Penyelidikan dan penerbitan"
  ],
  "Reviewed evidence & official sources": [
    "已审核证据与官方来源",
    "Preuves examinées et sources officielles",
    "Zweryfikowane dowody i oficjalne źródła",
    "Pruebas revisadas y fuentes oficiales",
    "Beoordeeld bewijs en officiële bronnen",
    "Bukti yang disemak dan sumber rasmi"
  ],
  "Reviewed evidence": [
    "已审核证据",
    "Preuves examinées",
    "Zweryfikowane dowody",
    "Pruebas revisadas",
    "Beoordeeld bewijs",
    "Bukti yang disemak"
  ],
  "View evidence": [
    "查看证据",
    "Voir les preuves",
    "Zobacz dowody",
    "Ver pruebas",
    "Bekijk bewijs",
    "Lihat bukti"
  ],
  "No reviewed evidence is included in this dimension.": [
    "此主题尚无已审核证据。",
    "Aucune preuve examinée n’est incluse pour ce thème.",
    "Dla tego tematu nie ma zweryfikowanych dowodów.",
    "Este tema no incluye pruebas revisadas.",
    "Dit onderwerp bevat geen beoordeeld bewijs.",
    "Tiada bukti yang disemak disertakan bagi topik ini."
  ],
  "Conditional": [
    "有条件",
    "Sous conditions",
    "Warunkowo",
    "Condicional",
    "Onder voorwaarden",
    "Bersyarat"
  ],
  "Required": [
    "必须",
    "Obligatoire",
    "Wymagane",
    "Obligatorio",
    "Verplicht",
    "Diwajibkan"
  ],
  "Restricted": [
    "受限",
    "Restreint",
    "Ograniczone",
    "Restringido",
    "Beperkt",
    "Terhad"
  ],
  "Allowed": [
    "允许",
    "Autorisé",
    "Dozwolone",
    "Permitido",
    "Toegestaan",
    "Dibenarkan"
  ],
  "Prohibited": [
    "禁止",
    "Interdit",
    "Zabronione",
    "Prohibido",
    "Verboden",
    "Dilarang"
  ],
  "Unclear": [
    "未明确",
    "Non précisé",
    "Niejasne",
    "No está claro",
    "Onduidelijk",
    "Tidak jelas"
  ],
  "Not mentioned in reviewed sources": [
    "已审核来源未提及",
    "Non mentionné dans les sources examinées",
    "Nie wspomniano w zweryfikowanych źródłach",
    "No se menciona en las fuentes revisadas",
    "Niet vermeld in beoordeelde bronnen",
    "Tidak disebut dalam sumber yang disemak"
  ],
  "Scope": [
    "适用范围",
    "Champ d’application",
    "Zakres",
    "Ámbito",
    "Toepassingsgebied",
    "Skop"
  ],
  "Open official source list": [
    "展开官方来源列表",
    "Ouvrir la liste des sources officielles",
    "Otwórz listę oficjalnych źródeł",
    "Abrir la lista de fuentes oficiales",
    "Open de lijst met officiële bronnen",
    "Buka senarai sumber rasmi"
  ],
  "Record information, JSON & citation": [
    "记录信息、JSON 与引用",
    "Informations, JSON et citation",
    "Informacje, JSON i cytowanie",
    "Información, JSON y cita",
    "Dossierinformatie, JSON en bronvermelding",
    "Maklumat rekod, JSON dan petikan"
  ],
  "Additional reviewed claims": [
    "其他已审核条款",
    "Autres énoncés examinés",
    "Dodatkowe zweryfikowane stwierdzenia",
    "Otras afirmaciones revisadas",
    "Overige beoordeelde uitspraken",
    "Pernyataan lain yang disemak"
  ],
  "Source URL": [
    "来源网址",
    "URL de la source",
    "Adres źródła",
    "URL de la fuente",
    "Bron-URL",
    "URL sumber"
  ],
  "Snapshot hash": [
    "快照哈希",
    "Empreinte de l’instantané",
    "Skrót migawki",
    "Hash de la instantánea",
    "Hash van momentopname",
    "Hash petikan"
  ],
  "Official university source": [
    "大学官方来源",
    "Source officielle de l’université",
    "Oficjalne źródło uczelni",
    "Fuente oficial de la universidad",
    "Officiële universiteitsbron",
    "Sumber rasmi universiti"
  ],
  "Student guide": [
    "学生指南",
    "Guide étudiant",
    "Przewodnik dla studentów",
    "Guía para estudiantes",
    "Studentengids",
    "Panduan pelajar"
  ],
  "Policy illustration": [
    "政策插图",
    "Illustration de la politique",
    "Ilustracja zasad",
    "Ilustración de la política",
    "Beleidsillustratie",
    "Ilustrasi dasar"
  ],
  "Research guidance": [
    "研究指南",
    "Conseils pour la recherche",
    "Wskazówki dotyczące badań",
    "Orientaciones para la investigación",
    "Onderzoeksrichtlijnen",
    "Panduan penyelidikan"
  ]
} as const;

const additionalUi: Record<string, readonly string[]> = {
  "Academic Integrity": ["学术诚信", "Intégrité académique", "Uczciwość akademicka", "Integridad académica", "Academische integriteit", "Integriti akademik"],
  "Teaching": ["教学", "Enseignement", "Nauczanie", "Docencia", "Onderwijs", "Pengajaran"],
  "Research": ["研究", "Recherche", "Badania", "Investigación", "Onderzoek", "Penyelidikan"],
  "Privacy": ["隐私", "Confidentialité", "Prywatność", "Privacidad", "Privacybescherming", "Privasi"],
  "Ai Tool Treatment": ["AI 工具使用规则", "Règles d’utilisation des outils d’IA", "Zasady używania narzędzi AI", "Reglas para herramientas de IA", "Regels voor AI-tools", "Peraturan alat AI"],
  "Security Review": ["安全审核", "Examen de sécurité", "Przegląd bezpieczeństwa", "Revisión de seguridad", "Beveiligingsbeoordeling", "Semakan keselamatan"],
  "Procurement": ["采购", "Achats", "Zakupy", "Adquisiciones", "Inkoop", "Perolehan"],
  "Source Status": ["来源状态", "État de la source", "Status źródła", "Estado de la fuente", "Bronstatus", "Status sumber"],
  "Other": ["其他", "Autres", "Inne", "Otros", "Overige", "Lain-lain"],
  "No reviewed student policy snapshot has been published yet.": ["尚无完整的学生政策摘要；可先查看已收录条款及来源。", "Aucun résumé complet des règles pour les étudiants n’est disponible ; consultez les énoncés et sources recueillis.", "Pełne podsumowanie zasad dla studentów nie jest jeszcze dostępne; sprawdź zebrane stwierdzenia i źródła.", "Aún no hay un resumen completo de las normas para estudiantes; consulta las afirmaciones y fuentes recopiladas.", "Er is nog geen volledige samenvatting van de studentenregels; bekijk de verzamelde uitspraken en bronnen.", "Ringkasan lengkap peraturan pelajar belum tersedia; rujuk pernyataan dan sumber yang dikumpulkan."],
  "Scope and transition details": ["适用范围与过渡细节", "Champ d’application et transition", "Zakres i zasady przejściowe", "Alcance y transición", "Reikwijdte en overgang", "Skop dan peralihan"],
  "Common situations": ["常见情境", "Situations courantes", "Typowe sytuacje", "Situaciones habituales", "Veelvoorkomende situaties", "Situasi lazim"],
  "Find your next step": ["找到下一步", "Trouvez votre prochaine étape", "Znajdź kolejny krok", "Encuentra tu siguiente paso", "Vind je volgende stap", "Cari langkah seterusnya"],
  "Research guidance": ["研究指引", "Conseils pour la recherche", "Wskazówki dotyczące badań", "Orientación para investigación", "Onderzoeksrichtlijnen", "Panduan penyelidikan"],
  "Updated": ["更新日期", "Mise à jour", "Aktualizacja", "Actualizado", "Bijgewerkt", "Dikemas kini"],
  "agent reviewed": ["已由代理审核", "Examiné par un agent", "Zweryfikowane przez agenta", "Revisado por un agente", "Beoordeeld door een agent", "Disemak oleh ejen"],
  "human reviewed": ["已人工审核", "Examiné par une personne", "Zweryfikowane przez człowieka", "Revisado por una persona", "Beoordeeld door een persoon", "Disemak oleh manusia"],
  "Snapshot status": ["快照状态", "État de l’instantané", "Status migawki", "Estado de la instantánea", "Status van momentopname", "Status petikan"],
  "strong": ["证据充分", "Preuves solides", "Mocne dowody", "Pruebas sólidas", "Sterk bewijs", "Bukti kukuh"],
  "Public JSON": ["公开 JSON", "JSON public", "Publiczny JSON", "JSON público", "Openbare JSON", "JSON awam"],

  "Allowed in this scope": ["在此范围内允许", "Autorisé dans ce cadre", "Dozwolone w tym zakresie", "Permitido en este ámbito", "Toegestaan binnen dit bereik", "Dibenarkan dalam skop ini"],
  "Blocked": ["禁止", "Interdit", "Zablokowane", "Bloqueado", "Geblokkeerd", "Disekat"],
  "Recommended": ["建议", "Recommandé", "Zalecane", "Recomendado", "Aanbevolen", "Disyorkan"],
  "Insufficient public evidence": ["公开证据不足", "Preuves publiques insuffisantes", "Niewystarczające dowody publiczne", "Pruebas públicas insuficientes", "Onvoldoende openbaar bewijs", "Bukti awam tidak mencukupi"],
  "Mixed scope": ["涉及多个范围", "Champ d’application mixte", "Zakres mieszany", "Ámbito mixto", "Gemengd toepassingsgebied", "Skop bercampur"],
  "University-wide": ["全校", "Toute l’université", "Cała uczelnia", "Toda la universidad", "Universiteitsbreed", "Seluruh universiti"],
  "Unit-specific": ["特定院系", "Unité spécifique", "Konkretna jednostka", "Unidad específica", "Specifieke afdeling", "Unit tertentu"],
  "Course or assessment": ["课程或评估", "Cours ou évaluation", "Kurs lub ocena", "Curso o evaluación", "Cursus of beoordeling", "Kursus atau penilaian"],
  "Research or thesis": ["研究或学位论文", "Recherche ou thèse", "Badania lub praca dyplomowa", "Investigación o tesis", "Onderzoek of scriptie", "Penyelidikan atau tesis"],
  "Related university AI policy records": ["相关大学 AI 政策记录", "Fiches de politiques d’IA d’autres universités", "Powiązane wpisy o zasadach AI na uczelniach", "Registros relacionados de políticas de IA universitarias", "Gerelateerde universitaire AI-beleidsdossiers", "Rekod dasar AI universiti yang berkaitan"]
};

const countWords = {
  zh: { claim: "{n} 条已审核条款", source: "{n} 个来源", record: "{n} 条记录" },
  fr: { claim: "{n} énoncés examinés", source: "{n} sources", record: "{n} fiches" },
  pl: { claim: "Zweryfikowane stwierdzenia: {n}", source: "Źródła: {n}", record: "Wpisy: {n}" },
  es: { claim: "Afirmaciones revisadas: {n}", source: "Fuentes: {n}", record: "Registros: {n}" },
  nl: { claim: "Beoordeelde uitspraken: {n}", source: "Bronnen: {n}", record: "Dossiers: {n}" },
  ms: { claim: "Pernyataan yang disemak: {n}", source: "Sumber: {n}", record: "Rekod: {n}" }
} as const;

export function translatePolicyReferenceUi(value: string, locale: SupportedLocale): string {
  if (locale === "en") return value === "No reviewed student policy snapshot has been published yet." ? "A complete student policy summary is not available yet; see the collected claims and sources." : value;
  const entry = policyReferenceUi[value as keyof typeof policyReferenceUi] ?? additionalUi[value];
  if (entry) return entry[languages.indexOf(locale)];
  const count = value.match(/^(\d+) (reviewed claims?|sources?|records?)$/);
  if (count) {
    const kind = count[2].startsWith("reviewed") ? "claim" : count[2].startsWith("source") ? "source" : "record";
    return countWords[locale][kind].replace("{n}", count[1]);
  }
  return translateSurfaceText(value, locale);
}
