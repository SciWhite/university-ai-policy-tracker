import type { SupportedLocale } from "./i18n";
const copy = {
  "en": {
    "cta": "Use in ChatGPT",
    "start": "Get started",
    "steps": [
      "Open the plugin listing and install University AI Policy Tracker.",
      "Start a new ChatGPT conversation and select the plugin, or mention it with @.",
      "Include your university’s full name. Check official sources and any course or faculty conditions."
    ],
    "examples": "Try a question",
    "copy": "Copy question",
    "copied": "Copied",
    "fallback": "Select and copy the question.",
    "technical": "MCP and developer details",
    "note": "No separate EduAI Policy account or API key is needed. ChatGPT availability depends on your account and workspace."
  },
  "zh": {
    "cta": "在 ChatGPT 使用",
    "start": "开始使用",
    "steps": [
      "打开插件商店页面，安装 University AI Policy Tracker。",
      "新建 ChatGPT 对话，选择该插件，或用 @ 指定它。",
      "提问时写出学校全名，核查官方来源及课程、院系的适用条件。"
    ],
    "examples": "试着提问",
    "copy": "复制问题",
    "copied": "已复制",
    "fallback": "请选择问题并复制。",
    "technical": "MCP 与开发者信息",
    "note": "无需另注册 EduAI Policy 账号或提供 API Key。ChatGPT 可用性取决于你的账号和工作区。"
  },
  "fr": {
    "cta": "Utiliser dans ChatGPT",
    "start": "Commencer",
    "steps": [
      "Ouvrez la fiche et installez University AI Policy Tracker.",
      "Démarrez une conversation ChatGPT et sélectionnez le plugin, ou mentionnez-le avec @.",
      "Indiquez le nom complet de l’université. Vérifiez les sources et les conditions du cours ou de la faculté."
    ],
    "examples": "Essayez une question",
    "copy": "Copier la question",
    "copied": "Copié",
    "fallback": "Sélectionnez et copiez la question.",
    "technical": "MCP et informations techniques",
    "note": "Aucun compte EduAI Policy ni clé API supplémentaire n’est nécessaire. La disponibilité dépend du compte ChatGPT et de l’espace de travail."
  },
  "pl": {
    "cta": "Użyj w ChatGPT",
    "start": "Jak zacząć",
    "steps": [
      "Otwórz stronę wtyczki i zainstaluj University AI Policy Tracker.",
      "Rozpocznij rozmowę w ChatGPT i wybierz wtyczkę lub oznacz ją przez @.",
      "Podaj pełną nazwę uczelni. Sprawdź źródła i warunki kursu lub wydziału."
    ],
    "examples": "Przykładowe pytania",
    "copy": "Kopiuj pytanie",
    "copied": "Skopiowano",
    "fallback": "Zaznacz i skopiuj pytanie.",
    "technical": "MCP i informacje techniczne",
    "note": "Nie potrzebujesz konta EduAI Policy ani klucza API. Dostępność zależy od konta ChatGPT i obszaru roboczego."
  },
  "es": {
    "cta": "Usar en ChatGPT",
    "start": "Cómo empezar",
    "steps": [
      "Abre la ficha e instala University AI Policy Tracker.",
      "Inicia una conversación en ChatGPT y selecciona el plugin o menciónalo con @.",
      "Indica el nombre completo de la universidad. Consulta las fuentes y condiciones del curso o facultad."
    ],
    "examples": "Prueba una pregunta",
    "copy": "Copiar pregunta",
    "copied": "Copiado",
    "fallback": "Selecciona y copia la pregunta.",
    "technical": "MCP e información técnica",
    "note": "No necesitas otra cuenta de EduAI Policy ni clave API. La disponibilidad depende de la cuenta de ChatGPT y del espacio de trabajo."
  },
  "nl": {
    "cta": "Gebruiken in ChatGPT",
    "start": "Aan de slag",
    "steps": [
      "Open de pluginpagina en installeer University AI Policy Tracker.",
      "Start een ChatGPT-gesprek en selecteer de plugin, of vermeld deze met @.",
      "Noem je universiteit voluit. Controleer bronnen en voorwaarden van je vak of faculteit."
    ],
    "examples": "Probeer een vraag",
    "copy": "Vraag kopiëren",
    "copied": "Gekopieerd",
    "fallback": "Selecteer en kopieer de vraag.",
    "technical": "MCP en technische informatie",
    "note": "Geen apart EduAI Policy-account of API-sleutel nodig. Beschikbaarheid hangt af van je ChatGPT-account en werkruimte."
  },
  "ms": {
    "cta": "Gunakan dalam ChatGPT",
    "start": "Mula menggunakan",
    "steps": [
      "Buka halaman plugin dan pasang University AI Policy Tracker.",
      "Mulakan perbualan ChatGPT dan pilih plugin, atau sebut dengan @.",
      "Nyatakan nama penuh universiti. Semak sumber rasmi serta syarat kursus atau fakulti."
    ],
    "examples": "Cuba soalan",
    "copy": "Salin soalan",
    "copied": "Disalin",
    "fallback": "Pilih dan salin soalan.",
    "technical": "MCP dan maklumat teknikal",
    "note": "Tiada akaun EduAI Policy berasingan atau kunci API diperlukan. Ketersediaan bergantung pada akaun ChatGPT dan ruang kerja."
  }
} satisfies Record<SupportedLocale, {cta:string;start:string;steps:string[];examples:string;copy:string;copied:string;fallback:string;technical:string;note:string}>;
export const pluginPromotionCopy = (locale: SupportedLocale) => copy[locale];
export const pluginExampleQuestions = [
"Can I use AI to proofread assignments at UCL?",
"How should I disclose AI use at the University of Toronto?",
"Which AI tools can Princeton students access?",
] as const;
