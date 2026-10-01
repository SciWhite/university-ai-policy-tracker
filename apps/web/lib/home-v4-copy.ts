import type { SupportedLocale } from "@/lib/i18n";

export interface HomeV4Topic {
  id: string;
  href: string;
  title: string;
  summary: string;
  icon: "coursework" | "disclosure" | "exams" | "approvedTools" | "privacyData" | "detectors";
}

export interface HomeV4Guide {
  slug: string;
  name: string;
  status: string;
  scopeNote: string;
  cta: string;
  thumbSrc: string;
  thumbAlt: string;
}

export interface HomeV4FaqItem {
  question: string;
  answer: string;
}

export interface HomeV4Copy {
  heroHeading: string;
  heroSubtitle: string;
  metaTitle: string;
  metaDescription: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchButton: string;
  examplesPrefix: string;
  browseAllUniversities: string;
  coverageNote: (universities: string, claims: string) => string;
  viewCoverage: string;
  heroArtAlt: string;
  topicsHeading: string;
  topicsIntro: string;
  topics: HomeV4Topic[];
  guidesHeading: string;
  guidesIntro: string;
  guides: HomeV4Guide[];
  viewGuide: string;
  recentChecksHeading: string;
  recentChecksSubtitle: string;
  viewChangesLog: string;
  checkedDatePrefix: string;
  claimsCountSuffix: string;
  noDate: string;
  regionsAndToolsHeading: string;
  regionsAndToolsSubtitle: string;
  regionsGroupTitle: string;
  toolsGroupTitle: string;
  institutionalDirectoriesTitle: string;
  unitedStatesLabel: string;
  unitedKingdomLabel: string;
  allRegionsDirectory: string;
  aiToolsDirectory: string;
  rankingsDirectory: string;
  rankingsNote: string;
  openDataHeading: string;
  sourcesPillarTitle: string;
  sourcesPillarText: string;
  sourcesLink: string;
  methodologyLink: string;
  citationPillarTitle: string;
  citationPillarText: string;
  citationLink: string;
  developerPillarTitle: string;
  developerPillarText: string;
  rightsNote: string;
  datasetsLink: string;
  apiLink: string;
  mcpLink: string;
  faqHeading: string;
  faqItems: HomeV4FaqItem[];
}

const copyByLocale: Record<SupportedLocale, HomeV4Copy> = {
  en: {
    heroHeading: "Find your university’s AI policy",
    heroSubtitle: "Explore guidance for assignments, disclosure and data safety, with links to official university sources.",
    metaTitle: "Find your university’s AI policy | University AI Policy Tracker",
    metaDescription: "Explore guidance for assignments, disclosure and data safety, with links to official university sources.",
    searchLabel: "Search universities or policy topics",
    searchPlaceholder: "University name or topic, e.g. Exeter or AI disclosure",
    searchButton: "Search",
    examplesPrefix: "Examples:",
    browseAllUniversities: "Browse all universities →",
    coverageNote: (u, c) => `Covering ${u} universities · ${c} source-backed policy claims`,
    viewCoverage: "View coverage",
    heroArtAlt: "Student studying in a university library with books and reference materials",
    topicsHeading: "What would you like to know?",
    topicsIntro: "Guidance is set by each university and course instructor. Select a topic to explore official policies and reviewed evidence.",
    topics: [
      {
        id: "coursework",
        href: "/themes/chatgpt-coursework-policy",
        title: "Can I use ChatGPT for coursework?",
        summary: "Rules vary by course and syllabus; check if your instructor allows generative assistance.",
        icon: "coursework"
      },
      {
        id: "disclosure",
        href: "/themes/ai-disclosure",
        title: "How should I disclose AI use?",
        summary: "Explore requirements for acknowledging tools, prompts, or specific contributions across institutions.",
        icon: "disclosure"
      },
      {
        id: "exams",
        href: "/themes/ai-in-exams",
        title: "What are the rules for AI in exams?",
        summary: "Compare exam-specific permissions, invigilated restrictions, and assessment conditions.",
        icon: "exams"
      },
      {
        id: "approvedTools",
        href: "/themes/approved-ai-tools",
        title: "Which AI tools have university guidance?",
        summary: "Institutional licenses or data guidelines; does not imply blanket coursework permission.",
        icon: "approvedTools"
      },
      {
        id: "privacyData",
        href: "/themes/privacy-data-entry",
        title: "What data should not be uploaded to AI?",
        summary: "Personal data, confidential research, and unreleased course materials must stay protected.",
        icon: "privacyData"
      },
      {
        id: "detectors",
        href: "/themes/ai-detectors",
        title: "How do universities treat AI detection tools?",
        summary: "Find guidance about detector limitations and institutional review procedures.",
        icon: "detectors"
      }
    ],
    guidesHeading: "See how university guidance looks",
    guidesIntro: "Reviewed student-first guides with clear scopes, exceptions, and links to source documents.",
    guides: [
      {
        slug: "stanford-university",
        name: "Stanford University",
        status: "Reviewed policy snapshot & claims",
        scopeNote: "School and course rules govern; PWR and MD/MSPA have different rules; not a campus-wide permission list.",
        cta: "View Stanford guide",
        thumbSrc: "/assets/home-v4/stanford-thumb.jpg",
        thumbAlt: "Stanford student consulting syllabus guidelines with course instructor"
      },
      {
        slug: "university-of-bristol",
        name: "University of Bristol",
        status: "Reviewed taught assessment claims",
        scopeNote: "Taught assessments; Category 2 is the default only when no different instructions are given.",
        cta: "View Bristol guide",
        thumbSrc: "/assets/home-v4/bristol-thumb.jpg",
        thumbAlt: "Bristol assessment framework showing four categories of permitted AI use"
      },
      {
        slug: "national-university-of-singapore",
        name: "National University of Singapore",
        status: "Reviewed policy snapshot & claims",
        scopeNote: "Unsupervised work defaults to acknowledged AI use; task instructions still govern.",
        cta: "View NUS guide",
        thumbSrc: "/assets/home-v4/nus-thumb.jpg",
        thumbAlt: "NUS student workflow illustrating check, use, and acknowledge steps"
      }
    ],
    viewGuide: "View guide",
    recentChecksHeading: "Recent checks",
    recentChecksSubtitle: "Verification dates for official university records, distinct from policy release dates.",
    viewChangesLog: "View policy change log →",
    checkedDatePrefix: "Checked",
    claimsCountSuffix: "claims",
    noDate: "Date unavailable",
    regionsAndToolsHeading: "Browse by region & tools",
    regionsAndToolsSubtitle: "Explore policies by jurisdiction or locate guidance for specific AI services.",
    regionsGroupTitle: "Regions",
    toolsGroupTitle: "Tools",
    institutionalDirectoriesTitle: "Institutional Directories",
    unitedStatesLabel: "United States",
    unitedKingdomLabel: "United Kingdom",
    allRegionsDirectory: "All regions directory →",
    aiToolsDirectory: "AI tools directory →",
    rankingsDirectory: "University rankings index →",
    rankingsNote: "Browsing directory by institutional cohort, not an assessment of policy quality.",
    openDataHeading: "Sources, methodology & open data",
    sourcesPillarTitle: "Official sources & verification",
    sourcesPillarText: "Records include official university web pages, PDF regulations, evidence excerpts, review states, and last-checked dates.",
    sourcesLink: "Official sources",
    methodologyLink: "Methodology",
    citationPillarTitle: "Citation & reproducibility",
    citationPillarText: "Records provide structured citation metadata, source URLs, and snapshot versions for academic and institutional research.",
    citationLink: "Citation guide",
    developerPillarTitle: "Open datasets & developer access",
    developerPillarText: "Access public JSON datasets, REST endpoints, and MCP server integrations. Structured metadata is provided freely under CC-BY-4.0.",
    rightsNote: "Official university policy documents and institutional trademarks remain the intellectual property of their respective universities.",
    datasetsLink: "Public datasets",
    apiLink: "API reference",
    mcpLink: "MCP server",
    faqHeading: "Frequently asked questions",
    faqItems: [
      {
        question: "How do I find my university’s AI policy?",
        answer: "Enter your institution's name or abbreviation in the search bar above, or browse by country and region."
      },
      {
        question: "Does this tracker declare whether AI is allowed or banned?",
        answer: "No. Generative AI policies depend on your specific university, department, and course instructor. Always consult your syllabus."
      },
      {
        question: "How is policy information verified?",
        answer: "Records are verified against published official university guidelines through agent and human review workflows, recording source URLs, review states, and evidence excerpts."
      },
      {
        question: "Are the underlying policy documents free to reuse?",
        answer: "The tracker's structured metadata is licensed under CC-BY-4.0. The original university policy texts and logos remain copyrighted by the respective institutions."
      }
    ]
  },
  zh: {
    heroHeading: "查找你大学的 AI 使用政策",
    heroSubtitle: "查看作业、AI 声明与数据保护相关规定，并核对大学官方来源。",
    metaTitle: "查找你大学的 AI 使用政策 | 大学 AI 政策追踪",
    metaDescription: "查看作业、AI 声明与数据保护相关规定，并核对大学官方来源。",
    searchLabel: "搜索大学或政策主题",
    searchPlaceholder: "大学名称或主题，例如 Exeter 或 AI disclosure",
    searchButton: "搜索",
    examplesPrefix: "示例：",
    browseAllUniversities: "浏览全部大学 →",
    coverageNote: (u, c) => `收录 ${u} 所大学 · ${c} 条有来源的政策主张`,
    viewCoverage: "查看覆盖范围",
    heroArtAlt: "在大学图书馆自习的学生，桌上放着参考书和笔记",
    topicsHeading: "你想了解什么？",
    topicsIntro: "具体规则由各大学和任课教师制定。选择主题查看官方政策规定与审核证据。",
    topics: [
      {
        id: "coursework",
        href: "/themes/chatgpt-coursework-policy",
        title: "作业中能否使用 ChatGPT？",
        summary: "规则因课程和教学大纲而异；请核实任课教师是否允许生成式辅助。",
        icon: "coursework"
      },
      {
        id: "disclosure",
        href: "/themes/ai-disclosure",
        title: "使用 AI 后如何声明？",
        summary: "探索各大学关于申报所用工具、提示词或具体贡献的相关要求。",
        icon: "disclosure"
      },
      {
        id: "exams",
        href: "/themes/ai-in-exams",
        title: "考试中的 AI 规则",
        summary: "比较各大学关于考试、监考限制和测评条件的具体规定。",
        icon: "exams"
      },
      {
        id: "approvedTools",
        href: "/themes/approved-ai-tools",
        title: "哪些 AI 工具有大学使用指引？",
        summary: "高校授权或数据合规指引；不代表作业中可随意使用。",
        icon: "approvedTools"
      },
      {
        id: "privacyData",
        href: "/themes/privacy-data-entry",
        title: "哪些资料不能上传到 AI？",
        summary: "个人数据、未公开研究成果与教学材料须严格保护。",
        icon: "privacyData"
      },
      {
        id: "detectors",
        href: "/themes/ai-detectors",
        title: "大学如何对待 AI 检测工具？",
        summary: "查阅关于 AI 检测工具局限性及机构审核流程的相关指引。",
        icon: "detectors"
      }
    ],
    guidesHeading: "看看大学指南长什么样",
    guidesIntro: "包含适用范围、例外条款与官方出处链接的学生政策指南样例。",
    guides: [
      {
        slug: "stanford-university",
        name: "斯坦福大学",
        status: "已审核政策快照与条款",
        scopeNote: "以院系和课程规则为准；PWR 与 MD/MSPA 规则不同，非全校统一许可。",
        cta: "查看斯坦福指南",
        thumbSrc: "/assets/home-v4/stanford-thumb.jpg",
        thumbAlt: "斯坦福学生与任课教师核对课程大纲的 AI 使用规定"
      },
      {
        slug: "university-of-bristol",
        name: "布里斯托大学",
        status: "已审核授课型考核条款",
        scopeNote: "授课型考核；未另作说明时默认执行第二类（Category 2）要求。",
        cta: "查看布里斯托指南",
        thumbSrc: "/assets/home-v4/bristol-thumb.jpg",
        thumbAlt: "布里斯托大学课程考核四类分类体系插图"
      },
      {
        slug: "national-university-of-singapore",
        name: "新加坡国立大学",
        status: "已审核政策快照与条款",
        scopeNote: "非监考作业默认允许在声明前提下使用；以具体任务要求为准。",
        cta: "查看国大指南",
        thumbSrc: "/assets/home-v4/nus-thumb.jpg",
        thumbAlt: "新加坡国立大学核查、使用并声明三步流程插图"
      }
    ],
    viewGuide: "查看指南",
    recentChecksHeading: "最近核查",
    recentChecksSubtitle: "大学官方页面的审核核验日期，与政策发布时间不同。",
    viewChangesLog: "查看政策变更记录 →",
    checkedDatePrefix: "核查于",
    claimsCountSuffix: "条条款",
    noDate: "无公开核查日期",
    regionsAndToolsHeading: "按地区与工具浏览",
    regionsAndToolsSubtitle: "按所在国家地区查找政策，或查看具体 AI 工具的使用指引。",
    regionsGroupTitle: "地区",
    toolsGroupTitle: "工具",
    institutionalDirectoriesTitle: "高校名录",
    unitedStatesLabel: "美国",
    unitedKingdomLabel: "英国",
    allRegionsDirectory: "全部地区目录 →",
    aiToolsDirectory: "AI 工具目录 →",
    rankingsDirectory: "大学排名索引 →",
    rankingsNote: "按高校分组浏览的检索目录，非政策质量评估排序。",
    openDataHeading: "来源、方法与开放数据",
    sourcesPillarTitle: "官方来源与审核核对",
    sourcesPillarText: "记录包含大学官方网页、PDF 规章、证据摘录、审核状态及最近核验日期。",
    sourcesLink: "官方来源",
    methodologyLink: "核查方法",
    citationPillarTitle: "学术引用与可复现性",
    citationPillarText: "记录提供结构化引用元数据、来源网址和快照版本，供学术与机构研究使用。",
    citationLink: "引用说明",
    developerPillarTitle: "开放数据集与开发者接口",
    developerPillarText: "提供公开 JSON 数据集、REST API 及 MCP 服务集成。结构化元数据遵循 CC-BY-4.0 协议开源。",
    rightsNote: "大学官方政策原文及高校商标版权归各自大学所有；本平台元数据采用 CC-BY-4.0 开放。",
    datasetsLink: "公开数据集",
    apiLink: "API 文档",
    mcpLink: "MCP 服务",
    faqHeading: "常见问题",
    faqItems: [
      {
        question: "如何查找我所在大学的 AI 政策？",
        answer: "在上方搜索框输入大学名称或缩写，或按国家与地区目录进行浏览。"
      },
      {
        question: "本站是否给出大学“允许”或“禁止”AI 的统一结论？",
        answer: "不给出统一结论。政策因大学、院系及具体课程大纲而异，请务必核对当门课要求。"
      },
      {
        question: "政策数据是如何核验的？",
        answer: "记录通过智能体核对与人工复核流程与大学官方指引进行验证，并记录来源链接、审核状态和证据摘录。"
      },
      {
        question: "这些政策文档可以自由复用吗？",
        answer: "平台的结构化元数据以 CC-BY-4.0 开放；大学政策原文与校名商标版权归属各自大学。"
      }
    ]
  },
  fr: {
    heroHeading: "Consultez la politique IA de votre université",
    heroSubtitle: "Découvrez les règles pour les devoirs, la déclaration et la sécurité des données, avec accès aux sources officielles.",
    metaTitle: "Consultez la politique IA de votre université | Suivi des politiques IA universitaires",
    metaDescription: "Découvrez les règles pour les devoirs, la déclaration et la sécurité des données, avec accès aux sources officielles.",
    searchLabel: "Rechercher des universités ou des thématiques",
    searchPlaceholder: "Nom d’université ou sujet, ex. Exeter ou AI disclosure",
    searchButton: "Rechercher",
    examplesPrefix: "Exemples :",
    browseAllUniversities: "Parcourir toutes les universités →",
    coverageNote: (u, c) => `Couvre ${u} universités · ${c} affirmations de politiques étayées par des sources`,
    viewCoverage: "Voir la couverture",
    heroArtAlt: "Étudiant révisant dans une bibliothèque universitaire avec livres et notes",
    topicsHeading: "Que souhaitez-vous savoir ?",
    topicsIntro: "Les règles sont définies par chaque université et enseignant. Choisissez un thème pour explorer les politiques officielles et les preuves vérifiées.",
    topics: [
      {
        id: "coursework",
        href: "/themes/chatgpt-coursework-policy",
        title: "Puis-je utiliser ChatGPT pour mes devoirs ?",
        summary: "Les règles varient selon le cours et le syllabus ; vérifiez si votre enseignant autorise l'aide générative.",
        icon: "coursework"
      },
      {
        id: "disclosure",
        href: "/themes/ai-disclosure",
        title: "Comment déclarer l'utilisation de l'IA ?",
        summary: "Explorez les exigences relatives à la déclaration des outils, prompts et contributions spécifiques selon les établissements.",
        icon: "disclosure"
      },
      {
        id: "exams",
        href: "/themes/ai-in-exams",
        title: "Quelles sont les règles pour l'IA lors des examens ?",
        summary: "Comparez les autorisations spécifiques aux examens, les restrictions sous surveillance et les conditions d'évaluation.",
        icon: "exams"
      },
      {
        id: "approvedTools",
        href: "/themes/approved-ai-tools",
        title: "Quels outils d'IA font l'objet de consignes universitaires ?",
        summary: "Licences institutionnelles ou règles de données ; n'implique pas une autorisation générale pour les devoirs.",
        icon: "approvedTools"
      },
      {
        id: "privacyData",
        href: "/themes/privacy-data-entry",
        title: "Quelles données ne doivent pas être transmises à une IA ?",
        summary: "Les données personnelles, recherches confidentielles et cours non publiés doivent être protégés.",
        icon: "privacyData"
      },
      {
        id: "detectors",
        href: "/themes/ai-detectors",
        title: "Comment les universités traitent-elles les détecteurs d'IA ?",
        summary: "Consultez les directives sur les limites des détecteurs d'IA et les procédures institutionnelles.",
        icon: "detectors"
      }
    ],
    guidesHeading: "Exemples de guides universitaires",
    guidesIntro: "Guides axés sur les étudiants avec périmètres clairs, exceptions et liens vers les sources officielles.",
    guides: [
      {
        slug: "stanford-university",
        name: "Stanford University",
        status: "Instantané de politique et affirmations vérifiés",
        scopeNote: "Les règles de facultés et de cours prévalent ; PWR et MD/MSPA ont des règles distinctes ; ne constitue pas une permission générale.",
        cta: "Consulter le guide Stanford",
        thumbSrc: "/assets/home-v4/stanford-thumb.jpg",
        thumbAlt: "Étudiant de Stanford vérifiant les consignes auprès d'un enseignant"
      },
      {
        slug: "university-of-bristol",
        name: "University of Bristol",
        status: "Affirmations vérifiées sur les évaluations",
        scopeNote: "Évaluations de cours ; la catégorie 2 s'applique par défaut en l'absence de consignes contraires.",
        cta: "Consulter le guide Bristol",
        thumbSrc: "/assets/home-v4/bristol-thumb.jpg",
        thumbAlt: "Tableau d'évaluation de Bristol selon quatre catégories"
      },
      {
        slug: "national-university-of-singapore",
        name: "National University of Singapore",
        status: "Instantané de politique et affirmations vérifiés",
        scopeNote: "Le travail non supervisé autorise l'IA sous réserve de déclaration ; les consignes de l'épreuve prévalent.",
        cta: "Consulter le guide NUS",
        thumbSrc: "/assets/home-v4/nus-thumb.jpg",
        thumbAlt: "Processus d'utilisation transparente de l'IA à NUS"
      }
    ],
    viewGuide: "Consulter le guide",
    recentChecksHeading: "Vérifications récentes",
    recentChecksSubtitle: "Dates de vérification des portails officiels, distinctes des dates de publication des politiques.",
    viewChangesLog: "Consulter le journal des modifications →",
    checkedDatePrefix: "Vérifié le",
    claimsCountSuffix: "affirmations",
    noDate: "Date non disponible",
    regionsAndToolsHeading: "Parcourir par région et outils",
    regionsAndToolsSubtitle: "Explorez les politiques par pays ou consultez les consignes par outil d'IA.",
    regionsGroupTitle: "Régions",
    toolsGroupTitle: "Outils",
    institutionalDirectoriesTitle: "Répertoires institutionnels",
    unitedStatesLabel: "États-Unis",
    unitedKingdomLabel: "Royaume-Uni",
    allRegionsDirectory: "Annuaire de toutes les régions →",
    aiToolsDirectory: "Annuaire des outils d'IA →",
    rankingsDirectory: "Index des classements universitaires →",
    rankingsNote: "Annuaire de consultation par groupe d'établissements, non un classement de la qualité des politiques.",
    openDataHeading: "Sources, méthodologie et données ouvertes",
    sourcesPillarTitle: "Sources officielles et vérification",
    sourcesPillarText: "Les fiches comprennent les pages officielles des universités, les règlements PDF, des extraits de preuves, les états d'évaluation et les dates de vérification.",
    sourcesLink: "Sources officielles",
    methodologyLink: "Méthodologie",
    citationPillarTitle: "Citation académique et reproductibilité",
    citationPillarText: "Les fiches fournissent des métadonnées de citation structurées, des URL sources et des versions d'instantanés pour la recherche académique.",
    citationLink: "Guide de citation",
    developerPillarTitle: "Jeux de données ouverts et accès API",
    developerPillarText: "Accédez aux jeux de données JSON publics, aux endpoints REST et au serveur MCP. Métadonnées structurées libres sous licence CC-BY-4.0.",
    rightsNote: "Les documents officiels et les marques institutionnelles restent la propriété intellectuelle exclusive de leurs universités respectives.",
    datasetsLink: "Jeux de données",
    apiLink: "Référence API",
    mcpLink: "Serveur MCP",
    faqHeading: "Foire aux questions",
    faqItems: [
      {
        question: "Comment trouver la politique IA de mon université ?",
        answer: "Saisissez le nom ou l'acronyme de votre université dans la barre de recherche ci-dessus, ou parcourez l'annuaire par pays."
      },
      {
        question: "Ce site indique-t-il si l'IA est globalement autorisée ou interdite ?",
        answer: "Non. Les politiques dépendent de chaque université, faculté et enseignant. Référez-vous toujours au syllabus de votre cours."
      },
      {
        question: "Comment les données de politiques sont-elles vérifiées ?",
        answer: "Les fiches sont vérifiées par rapport aux directives officielles des universités via des flux automatisés et de révision humaine, en consignant les URL sources, états de révision et extraits de preuves."
      },
      {
        question: "Les textes des règlements sont-ils libres de réutilisation ?",
        answer: "Les métadonnées structurées du projet sont sous licence CC-BY-4.0 ; les textes intégraux des règlements et les marques appartiennent aux universités respectives."
      }
    ]
  },
  pl: {
    heroHeading: "Znajdź zasady dotyczące sztucznej inteligencji na Twojej uczelni",
    heroSubtitle: "Sprawdź wytyczne dotyczące prac zaliczeniowych, deklarowania AI oraz bezpieczeństwa danych, wraz z linkami do oficjalnych źródeł uczelni.",
    metaTitle: "Zasady AI na Twojej uczelni | Rejestr polityk AI uczelni wyższych",
    metaDescription: "Sprawdź wytyczne dotyczące prac zaliczeniowych, deklarowania AI oraz bezpieczeństwa danych, wraz z linkami do oficjalnych źródeł uczelni.",
    searchLabel: "Szukaj uczelni lub tematów polityk",
    searchPlaceholder: "Nazwa uczelni lub temat, np. Exeter lub AI disclosure",
    searchButton: "Szukaj",
    examplesPrefix: "Przykłady:",
    browseAllUniversities: "Przeglądaj wszystkie uczelnie →",
    coverageNote: (u, c) => `Obejmuje ${u} uczelni · ${c} potwierdzonych źródłowo twierdzeń z polityk`,
    viewCoverage: "Zobacz zakres bazy",
    heroArtAlt: "Student uczący się w bibliotece uniwersyteckiej z książkami i notatkami",
    topicsHeading: "Czego chcesz się dowiedzieć?",
    topicsIntro: "Wytyczne są ustalane przez poszczególne uczelnie i prowadzących zajęcia. Wybierz temat, aby poznać oficjalne zasady i zweryfikowane źródła.",
    topics: [
      {
        id: "coursework",
        href: "/themes/chatgpt-coursework-policy",
        title: "Czy mogę używać ChatGPT w pracach zaliczeniowych?",
        summary: "Zasady zależą od przedmiotu i sylabusa; sprawdź, czy prowadzący dopuszcza wsparcie generatywne.",
        icon: "coursework"
      },
      {
        id: "disclosure",
        href: "/themes/ai-disclosure",
        title: "Jak należy zadeklarować użycie sztucznej inteligencji?",
        summary: "Sprawdź wymagania dotyczące zgłaszania użytych narzędzi, promptów oraz konkretnego wkładu w poszczególnych uczelniach.",
        icon: "disclosure"
      },
      {
        id: "exams",
        href: "/themes/ai-in-exams",
        title: "Jakie są reguły dotyczące AI na egzaminach?",
        summary: "Porównaj zasady egzaminacyjne, ograniczenia podczas egzaminów nadzorowanych oraz warunki oceniania.",
        icon: "exams"
      },
      {
        id: "approvedTools",
        href: "/themes/approved-ai-tools",
        title: "Dla których narzędzi AI uczelnie wydały wytyczne?",
        summary: "Licencje instytucjonalne lub ochrona danych; nie oznacza to ogólnej zgody na użycie w pracach.",
        icon: "approvedTools"
      },
      {
        id: "privacyData",
        href: "/themes/privacy-data-entry",
        title: "Jakich danych nie wolno przekazywać do AI?",
        summary: "Dane osobowe, poufne badania naukowe i materiały dydaktyczne podlegają bezwzględnej ochronie.",
        icon: "privacyData"
      },
      {
        id: "detectors",
        href: "/themes/ai-detectors",
        title: "Jak uczelnie podchodzą do detektorów AI?",
        summary: "Poznaj wytyczne dotyczące ograniczeń detektorów AI oraz uczelnianych procedur weryfikacji.",
        icon: "detectors"
      }
    ],
    guidesHeading: "Przykłady przewodników uczelnianych",
    guidesIntro: "Zweryfikowane przewodniki dla studentów z jasnym zakresem, wyjątkami i linkami do źródeł.",
    guides: [
      {
        slug: "stanford-university",
        name: "Stanford University",
        status: "Zweryfikowany wyciąg i twierdzenia",
        scopeNote: "Decydują zasady wydziałów i kursów; PWR oraz MD/MSPA mają odrębne reguły; brak ogólnouczelnianej zgody.",
        cta: "Zobacz przewodnik po Stanfordzie",
        thumbSrc: "/assets/home-v4/stanford-thumb.jpg",
        thumbAlt: "Student Stanfordu konsultujący zasady sylabusa z wykładowcą"
      },
      {
        slug: "university-of-bristol",
        name: "University of Bristol",
        status: "Zweryfikowane twierdzenia o zaliczeniach",
        scopeNote: "Ocenianie dydaktyczne; kategoria 2 obowiązuje domyślnie, o ile nie podano odmiennych instrukcji.",
        cta: "Zobacz przewodnik po Bristolu",
        thumbSrc: "/assets/home-v4/bristol-thumb.jpg",
        thumbAlt: "Ilustracja 4 kategorii oceniania na Uniwersytecie w Bristolu"
      },
      {
        slug: "national-university-of-singapore",
        name: "National University of Singapore",
        status: "Zweryfikowany wyciąg i twierdzenia",
        scopeNote: "W pracach nienadzorowanych dozwolone użycie AI z deklaracją; decydują szczegółowe wytyczne zadania.",
        cta: "Zobacz przewodnik po NUS",
        thumbSrc: "/assets/home-v4/nus-thumb.jpg",
        thumbAlt: "Ilustracja procesu weryfikacji i deklarowania AI na NUS"
      }
    ],
    viewGuide: "Zobacz przewodnik",
    recentChecksHeading: "Ostatnie weryfikacje",
    recentChecksSubtitle: "Daty weryfikacji oficjalnych portali uczelni, odrębne od dat publikacji dokumentów.",
    viewChangesLog: "Zobacz rejestr zmian polityk →",
    checkedDatePrefix: "Sprawdzono:",
    claimsCountSuffix: "twierdzeń",
    noDate: "Brak daty",
    regionsAndToolsHeading: "Przeglądaj wg regionów i narzędzi",
    regionsAndToolsSubtitle: "Wyszukuj regulacje wg jurysdykcji lub sprawdź wytyczne dla konkretnych usług AI.",
    regionsGroupTitle: "Regiony",
    toolsGroupTitle: "Narzędzia",
    institutionalDirectoriesTitle: "Katalogi instytucjonalne",
    unitedStatesLabel: "Stany Zjednoczone",
    unitedKingdomLabel: "Wielka Brytania",
    allRegionsDirectory: "Katalog wszystkich regionów →",
    aiToolsDirectory: "Katalog narzędzi AI →",
    rankingsDirectory: "Indeks rankingów uczelni →",
    rankingsNote: "Indeks pomocniczy wg grup uczelni, nie stanowiący oceny jakości ich regulacji.",
    openDataHeading: "Źródła, metodyka i otwarte dane",
    sourcesPillarTitle: "Oficjalne źródła i weryfikacja",
    sourcesPillarText: "Wpisy zawierają oficjalne strony uczelni, regulaminy PDF, fragmenty dowodów, stany weryfikacji oraz daty ostatniego sprawdzenia.",
    sourcesLink: "Oficjalne źródła",
    methodologyLink: "Metodyka",
    citationPillarTitle: "Cytowanie i powtarzalność badań",
    citationPillarText: "Wpisy zapewniają ustrukturyzowane metadane cytowań, adresy URL źródeł oraz wersje migawek do badań akademickich.",
    citationLink: "Zasady cytowania",
    developerPillarTitle: "Otwarte zbiory danych i API",
    developerPillarText: "Dostęp do publicznych zbiorów JSON, interfejsów REST i serwera MCP. Dane strukturalne udostępniane na licencji CC-BY-4.0.",
    rightsNote: "Oficjalne dokumenty uczelni i znaki towarowe pozostają własnością intelektualną odpowiednich uniwersytetów.",
    datasetsLink: "Zbiory danych",
    apiLink: "Dokumentacja API",
    mcpLink: "Serwer MCP",
    faqHeading: "Często zadawane pytania",
    faqItems: [
      {
        question: "Jak znaleźć politykę AI mojej uczelni?",
        answer: "Wpisz nazwę uczelni lub skrót w pasku wyszukiwania powyżej albo skorzystaj z katalogu państw."
      },
      {
        question: "Czy ten serwis jednoznacznie stwierdza, czy AI jest dozwolona czy zakazana?",
        answer: "Nie. Wytyczne zależą od konkretnej uczelni, wydziału i prowadzącego przedmiot. Zawsze sprawdzaj sylabus."
      },
      {
        question: "W jaki sposób weryfikowane są informacje o politykach?",
        answer: "Wpisy są weryfikowane na podstawie oficjalnych wytycznych uczelni w ramach procesów zautomatyzowanych i weryfikacji przez człowieka, z rejestracją adresów źródłowych, stanów przeglądu i fragmentów dowodów."
      },
      {
        question: "Czy treść regulaminów można swobodnie wykorzystywać?",
        answer: "Strukturalne metadane rejestru są na licencji CC-BY-4.0; teksty regulaminów i logotypy podlegają prawom autorskim uczelni."
      }
    ]
  },
  es: {
    heroHeading: "Consulta la política de IA de tu universidad",
    heroSubtitle: "Revisa directrices sobre tareas, declaración del uso de IA y seguridad de datos, con enlaces a fuentes oficiales universitarias.",
    metaTitle: "Consulta la política de IA de tu universidad | Rastreador de políticas de IA universitaria",
    metaDescription: "Revisa directrices sobre tareas, declaración del uso de IA y seguridad de datos, con enlaces a fuentes oficiales universitarias.",
    searchLabel: "Buscar universidades o temas de política",
    searchPlaceholder: "Nombre de la universidad o tema, ej. Exeter o AI disclosure",
    searchButton: "Buscar",
    examplesPrefix: "Ejemplos:",
    browseAllUniversities: "Explorar todas las universidades →",
    coverageNote: (u, c) => `Cubre ${u} universidades · ${c} afirmaciones de políticas con fuentes`,
    viewCoverage: "Ver cobertura",
    heroArtAlt: "Estudiante estudiando en la biblioteca universitaria con libros y apuntes",
    topicsHeading: "¿Qué necesitas saber?",
    topicsIntro: "Las directrices son establecidas por cada universidad y profesor. Elige un tema para explorar normativas oficiales y evidencias verificadas.",
    topics: [
      {
        id: "coursework",
        href: "/themes/chatgpt-coursework-policy",
        title: "¿Puedo usar ChatGPT en mis tareas?",
        summary: "Las normas varían según el curso y el programa de la asignatura; consulta si tu profesor permite apoyo generativo.",
        icon: "coursework"
      },
      {
        id: "disclosure",
        href: "/themes/ai-disclosure",
        title: "¿Cómo debo declarar el uso de IA?",
        summary: "Explore los requisitos para declarar herramientas, prompts o contribuciones específicas en cada institución.",
        icon: "disclosure"
      },
      {
        id: "exams",
        href: "/themes/ai-in-exams",
        title: "¿Cuáles son las normas sobre IA en los exámenes?",
        summary: "Compare permisos específicos para exámenes, restricciones bajo supervisión y condiciones de evaluación.",
        icon: "exams"
      },
      {
        id: "approvedTools",
        href: "/themes/approved-ai-tools",
        title: "¿Qué herramientas de IA cuentan con directrices universitarias?",
        summary: "Licencias institucionales o directrices de datos; no implica permiso general para tareas.",
        icon: "approvedTools"
      },
      {
        id: "privacyData",
        href: "/themes/privacy-data-entry",
        title: "¿Qué datos no deben subirse a una IA?",
        summary: "Los datos personales, investigaciones confidenciales y materiales docentes deben mantenerse protegidos.",
        icon: "privacyData"
      },
      {
        id: "detectors",
        href: "/themes/ai-detectors",
        title: "¿Cómo tratan las universidades los detectores de IA?",
        summary: "Consulte orientaciones sobre las limitaciones de detectores y los procedimientos de revisión institucional.",
        icon: "detectors"
      }
    ],
    guidesHeading: "Ejemplos de guías universitarias",
    guidesIntro: "Guías verificadas para estudiantes con ámbitos claros, excepciones y enlaces a normativas oficiales.",
    guides: [
      {
        slug: "stanford-university",
        name: "Stanford University",
        status: "Resumen de políticas y afirmaciones revisadas",
        scopeNote: "Prevalecen las normas del centro y de la asignatura; PWR y MD/MSPA tienen reglas distintas; no es un permiso general.",
        cta: "Ver guía de Stanford",
        thumbSrc: "/assets/home-v4/stanford-thumb.jpg",
        thumbAlt: "Estudiante de Stanford consultando el programa del curso con el docente"
      },
      {
        slug: "university-of-bristol",
        name: "University of Bristol",
        status: "Afirmaciones revisadas para evaluaciones docentes",
        scopeNote: "Evaluaciones regladas; la Categoría 2 se aplica por defecto salvo indicación expresa en contrario.",
        cta: "Ver guía de Bristol",
        thumbSrc: "/assets/home-v4/bristol-thumb.jpg",
        thumbAlt: "Esquema de cuatro categorías de evaluación en Bristol"
      },
      {
        slug: "national-university-of-singapore",
        name: "National University of Singapore",
        status: "Resumen de políticas y afirmaciones revisadas",
        scopeNote: "Las tareas no supervisadas permiten IA declarando su uso; prevalecen las instrucciones de cada trabajo.",
        cta: "Ver guía de NUS",
        thumbSrc: "/assets/home-v4/nus-thumb.jpg",
        thumbAlt: "Procedimiento de uso responsable y declaración de IA en NUS"
      }
    ],
    viewGuide: "Ver guía",
    recentChecksHeading: "Revisiones recientes",
    recentChecksSubtitle: "Fechas de verificación en los portales oficiales, independientes de las fechas de publicación de las políticas.",
    viewChangesLog: "Ver registro de cambios →",
    checkedDatePrefix: "Revisado el",
    claimsCountSuffix: "afirmaciones",
    noDate: "Fecha no disponible",
    regionsAndToolsHeading: "Explorar por región y herramientas",
    regionsAndToolsSubtitle: "Explora políticas por país o consulta directrices sobre servicios específicos de IA.",
    regionsGroupTitle: "Regiones",
    toolsGroupTitle: "Herramientas",
    institutionalDirectoriesTitle: "Directorios institucionales",
    unitedStatesLabel: "Estados Unidos",
    unitedKingdomLabel: "Reino Unido",
    allRegionsDirectory: "Directorio de todas las regiones →",
    aiToolsDirectory: "Directorio de herramientas de IA →",
    rankingsDirectory: "Índice de clasificaciones universitarias →",
    rankingsNote: "Directorio de navegación por grupo institucional, no una evaluación de la calidad de sus políticas.",
    openDataHeading: "Fuentes, metodología y datos abiertos",
    sourcesPillarTitle: "Fuentes oficiales y verificación",
    sourcesPillarText: "Los registros incluyen páginas web oficiales universitarias, normativas en PDF, extractos de evidencia, estados de revisión y fechas de última comprobación.",
    sourcesLink: "Fuentes oficiales",
    methodologyLink: "Metodología",
    citationPillarTitle: "Citas académicas y reproducibilidad",
    citationPillarText: "Los registros proporcionan metadatos de citación estructurados, URLs de origen y versiones de instantáneas para investigación académica.",
    citationLink: "Guía de citas",
    developerPillarTitle: "Conjuntos de datos abiertos y API",
    developerPillarText: "Accede a datasets JSON públicos, endpoints REST e integración MCP. Metadatos estructurados disponibles bajo licencia CC-BY-4.0.",
    rightsNote: "Los documentos normativos oficiales y las marcas universitarias permanecen bajo los derechos de propiedad intelectual de sus respectivas universidades.",
    datasetsLink: "Conjuntos de datos",
    apiLink: "Referencia API",
    mcpLink: "Servidor MCP",
    faqHeading: "Preguntas frecuentes",
    faqItems: [
      {
        question: "¿Cómo encuentro la política de IA de mi universidad?",
        answer: "Escribe el nombre o siglas de tu universidad en el buscador superior, o navega por el directorio de países."
      },
      {
        question: "¿Este rastreador declara si la IA está permitida o prohibida?",
        answer: "No. Las normas dependen de cada universidad, facultad y profesor. Consulta siempre el programa de tu asignatura."
      },
      {
        question: "¿Cómo se verifica la información sobre las políticas?",
        answer: "Los registros se verifican contrastando las directrices oficiales universitarias mediante flujos de agentes y revisión humana, registrando URLs de origen, estados de revisión y extractos de evidencia."
      },
      {
        question: "¿Se pueden reutilizar libremente los textos de las políticas?",
        answer: "Los metadatos estructurados se licencian bajo CC-BY-4.0; los textos normativos y marcas pertenecen a sus universidades."
      }
    ]
  },
  nl: {
    heroHeading: "Vind het AI-beleid van je universiteit",
    heroSubtitle: "Bekijk richtlijnen voor opdrachten, AI-verantwoording en gegevensbescherming, met links naar officiële universitaire bronnen.",
    metaTitle: "Vind het AI-beleid van je universiteit | Universitair AI-beleidoverzicht",
    metaDescription: "Bekijk richtlijnen voor opdrachten, AI-verantwoording en gegevensbescherming, met links naar officiële universitaire bronnen.",
    searchLabel: "Zoek universiteiten of beleidsonderwerpen",
    searchPlaceholder: "Universiteitsnaam of onderwerp, bijv. Exeter of AI disclosure",
    searchButton: "Zoeken",
    examplesPrefix: "Voorbeelden:",
    browseAllUniversities: "Bekijk alle universiteiten →",
    coverageNote: (u, c) => `Omvat ${u} universiteiten · ${c} door bronnen onderbouwde beleidsclaims`,
    viewCoverage: "Bekijk dekking",
    heroArtAlt: "Student die studeert in een universiteitsbibliotheek met boeken en aantekeningen",
    topicsHeading: "Wat wil je weten?",
    topicsIntro: "Richtlijnen worden vastgesteld door elke universiteit en docent. Kies een onderwerp om officiële regels en geverifieerd bewijs te bekijken.",
    topics: [
      {
        id: "coursework",
        href: "/themes/chatgpt-coursework-policy",
        title: "Mag ik ChatGPT gebruiken voor opdrachten?",
        summary: "Regels verschillen per vak en syllabus; controleer of je docent generatieve ondersteuning toestaat.",
        icon: "coursework"
      },
      {
        id: "disclosure",
        href: "/themes/ai-disclosure",
        title: "Hoe moet ik AI-gebruik verantwoorden?",
        summary: "Bekijk de vereisten voor het vermelden van hulpmiddelen, prompts en specifieke bijdragen per instelling.",
        icon: "disclosure"
      },
      {
        id: "exams",
        href: "/themes/ai-in-exams",
        title: "Wat zijn de regels voor AI bij tentamens?",
        summary: "Vergelijk toelatingen, beperkingen tijdens surveillances en toetsvoorwaarden per instelling.",
        icon: "exams"
      },
      {
        id: "approvedTools",
        href: "/themes/approved-ai-tools",
        title: "Voor welke AI-tools zijn universitaire richtlijnen opgesteld?",
        summary: "Instellingslicenties of privacyrichtlijnen; dit houdt geen algemene toestemming in voor opdrachten.",
        icon: "approvedTools"
      },
      {
        id: "privacyData",
        href: "/themes/privacy-data-entry",
        title: "Welke gegevens mogen niet naar AI worden geüpload?",
        summary: "Persoonsgegevens, vertrouwelijk onderzoek en niet-gepubliceerd lesmateriaal moeten beschermd blijven.",
        icon: "privacyData"
      },
      {
        id: "detectors",
        href: "/themes/ai-detectors",
        title: "Hoe gaan universiteiten om met AI-detectietools?",
        summary: "Vind richtlijnen over de beperkingen van AI-detectietools en institutionele beoordelingsprocedures.",
        icon: "detectors"
      }
    ],
    guidesHeading: "Voorbeelden van universitaire gidsen",
    guidesIntro: "Geverifieerde studentgerichte gidsen met duidelijke afbakeningen, uitzonderingen en bronlinks.",
    guides: [
      {
        slug: "stanford-university",
        name: "Stanford University",
        status: "Geverifieerd beleidsoverzicht en claims",
        scopeNote: "Regels van faculteit en vak zijn leidend; PWR en MD/MSPA hebben eigen regels; geen algemene campusbrede toestemming.",
        cta: "Bekijk Stanford-gids",
        thumbSrc: "/assets/home-v4/stanford-thumb.jpg",
        thumbAlt: "Stanford-student die syllabusrangschikkingen controleert bij een docent"
      },
      {
        slug: "university-of-bristol",
        name: "University of Bristol",
        status: "Geverifieerde claims voor onderwijstoetsing",
        scopeNote: "Onderwijstoetsing; Categorie 2 is de standaard, tenzij de opdracht andere instructies geeft.",
        cta: "Bekijk Bristol-gids",
        thumbSrc: "/assets/home-v4/bristol-thumb.jpg",
        thumbAlt: "Vier categorieën van toetsingsbeleid aan de Universiteit van Bristol"
      },
      {
        slug: "national-university-of-singapore",
        name: "National University of Singapore",
        status: "Geverifieerd beleidsoverzicht en claims",
        scopeNote: "Niet-gesurveilleerd werk staat AI toe met bronvermelding; specifieke taakinstructies blijven leidend.",
        cta: "Bekijk NUS-gids",
        thumbSrc: "/assets/home-v4/nus-thumb.jpg",
        thumbAlt: "Stappenplan voor transparant AI-gebruik aan de National University of Singapore"
      }
    ],
    viewGuide: "Bekijk gids",
    recentChecksHeading: "Recente controles",
    recentChecksSubtitle: "Verificatiedata van officiële universitaire portals, los van de publicatiedatum van het beleid.",
    viewChangesLog: "Bekijk beleidswijzigingenoverzicht →",
    checkedDatePrefix: "Gecontroleerd op",
    claimsCountSuffix: "claims",
    noDate: "Geen datum beschikbaar",
    regionsAndToolsHeading: "Blader op regio en tools",
    regionsAndToolsSubtitle: "Verken beleid per land of vind richtlijnen voor specifieke AI-tools.",
    regionsGroupTitle: "Regio's",
    toolsGroupTitle: "Hulpmiddelen",
    institutionalDirectoriesTitle: "Instellingsgidsen",
    unitedStatesLabel: "Verenigde Staten",
    unitedKingdomLabel: "Verenigd Koninkrijk",
    allRegionsDirectory: "Alle regio's overzicht →",
    aiToolsDirectory: "AI-toolsoverzicht →",
    rankingsDirectory: "Universitaire ranglijstenindex →",
    rankingsNote: "Navigatieoverzicht per instellingsgroep, geen kwaliteitsbeoordeling van het beleid.",
    openDataHeading: "Bronnen, methodologie en open data",
    sourcesPillarTitle: "Officiële bronnen en verificatie",
    sourcesPillarText: "Gegevens bevatten officiële universitaire webpagina's, PDF-reglementen, bewijsfragmenten, beoordelingsstatussen en datums van laatste controle.",
    sourcesLink: "Officiële bronnen",
    methodologyLink: "Methodologie",
    citationPillarTitle: "Citatie en reproduceerbaarheid",
    citationPillarText: "Gegevens bieden gestructureerde citatiemetadata, bron-URL's en snapshotversies voor academisch en institutioneel onderzoek.",
    citationLink: "Citatiegids",
    developerPillarTitle: "Open datasets en ontwikkelaars-API",
    developerPillarText: "Toegang tot openbare JSON-datasets, REST-eindpunten en MCP-server. Gestructureerde metadata vrij beschikbaar onder CC-BY-4.0.",
    rightsNote: "Officiële universitaire documenten en merken blijven het intellectuele eigendom van de betreffende universiteiten.",
    datasetsLink: "Openbare datasets",
    apiLink: "API-documentatie",
    mcpLink: "MCP-server",
    faqHeading: "Veelgestelde vragen",
    faqItems: [
      {
        question: "Hoe vind ik het AI-beleid van mijn universiteit?",
        answer: "Vul de naam of afkorting van je universiteit in de zoekbalk hierboven in, of blader op land en regio."
      },
      {
        question: "Geeft dit overzicht aan of AI overal is toegestaan of verboden?",
        answer: "Nee. Het beleid verschilt per universiteit, faculteit en vakdocent. Raadpleeg altijd je vaksyllabus."
      },
      {
        question: "Hoe wordt de beleidsinformatie gecontroleerd?",
        answer: "Gegevens worden geverifieerd aan de hand van gepubliceerde officiële universitaire richtlijnen via agent- en menselijke revisieprocessen, waarbij bron-URL's, revisiestatussen en bewijsfragmenten worden vastgelegd."
      },
      {
        question: "Mogen de beleidsteksten vrij worden hergebruikt?",
        answer: "De gestructureerde metadata valt onder CC-BY-4.0; de onderliggende teksten en beeldmerken blijven eigendom van de universiteiten."
      }
    ]
  },
  ms: {
    heroHeading: "Cari dasar AI universiti anda",
    heroSubtitle: "Terokai panduan tugasan, pengisytiharan penggunaan AI dan keselamatan data, disertakan pautan ke sumber rasmi universiti.",
    metaTitle: "Cari dasar AI universiti anda | Penjejak Dasar AI Universiti",
    metaDescription: "Terokai panduan tugasan, pengisytiharan penggunaan AI dan keselamatan data, disertakan pautan ke sumber rasmi universiti.",
    searchLabel: "Cari universiti atau topik dasar",
    searchPlaceholder: "Nama universiti atau topik, cth. Exeter atau AI disclosure",
    searchButton: "Cari",
    examplesPrefix: "Contoh:",
    browseAllUniversities: "Lihat semua universiti →",
    coverageNote: (u, c) => `Merangkumi ${u} universiti · ${c} tuntutan dasar bersandarkan sumber`,
    viewCoverage: "Lihat liputan",
    heroArtAlt: "Pelajar sedang mengulang kaji di perpustakaan universiti dengan buku dan nota",
    topicsHeading: "Apa yang ingin anda ketahui?",
    topicsIntro: "Garis panduan ditetapkan oleh setiap universiti dan pensyarah kursus. Pilih topik untuk melihat dasar rasmi dan bukti yang disemak.",
    topics: [
      {
        id: "coursework",
        href: "/themes/chatgpt-coursework-policy",
        title: "Bolehkah saya menggunakan ChatGPT untuk tugasan?",
        summary: "Peraturan berbeza mengikut kursus dan sukatan pelajaran; semak sama ada pensyarah anda membenarkan bantuan generatif.",
        icon: "coursework"
      },
      {
        id: "disclosure",
        href: "/themes/ai-disclosure",
        title: "Bagaimana cara mengisytiharkan penggunaan AI?",
        summary: "Terokai keperluan untuk menyatakan penggunaan alat, gesaan atau sumbangan khusus mengikut institusi.",
        icon: "disclosure"
      },
      {
        id: "exams",
        href: "/themes/ai-in-exams",
        title: "Apakah peraturan AI semasa peperiksaan?",
        summary: "Bandingkan kebenaran peperiksaan khusus, sekatan pengawasan dan syarat penilaian.",
        icon: "exams"
      },
      {
        id: "approvedTools",
        href: "/themes/approved-ai-tools",
        title: "Alat AI manakah yang mempunyai panduan universiti?",
        summary: "Lesen institusi atau garis panduan perlindungan data; tidak membayangkan kebenaran umum untuk tugasan.",
        icon: "approvedTools"
      },
      {
        id: "privacyData",
        href: "/themes/privacy-data-entry",
        title: "Apakah data yang tidak boleh dimuat naik ke AI?",
        summary: "Data peribadi, penyelidikan sulit dan bahan kursus yang belum diterbitkan mesti dilindungi.",
        icon: "privacyData"
      },
      {
        id: "detectors",
        href: "/themes/ai-detectors",
        title: "Bagaimanakah universiti menangani alat pengesan AI?",
        summary: "Dapatkan panduan tentang batasan alat pengesan AI serta prosedur semakan institusi.",
        icon: "detectors"
      }
    ],
    guidesHeading: "Lihat contoh panduan universiti",
    guidesIntro: "Panduan khusus pelajar yang telah disemak dengan skop jelas, pengecualian dan pautan ke dokumen sumber.",
    guides: [
      {
        slug: "stanford-university",
        name: "Stanford University",
        status: "Petikan dasar dan tuntutan yang disemak",
        scopeNote: "Tertakluk kepada peraturan fakulti dan kursus; PWR dan MD/MSPA mempunyai peraturan berbeza; bukan kebenaran menyeluruh.",
        cta: "Lihat panduan Stanford",
        thumbSrc: "/assets/home-v4/stanford-thumb.jpg",
        thumbAlt: "Pelajar Stanford menyemak peraturan sukatan pelajaran bersama pensyarah"
      },
      {
        slug: "university-of-bristol",
        name: "University of Bristol",
        status: "Tuntutan penilaian kursus yang disemak",
        scopeNote: "Penilaian pengajaran; Kategori 2 ialah tetapan lalai melainkan arahan berbeza diberikan.",
        cta: "Lihat panduan Bristol",
        thumbSrc: "/assets/home-v4/bristol-thumb.jpg",
        thumbAlt: "Gambar rajah empat kategori penilaian di University of Bristol"
      },
      {
        slug: "national-university-of-singapore",
        name: "National University of Singapore",
        status: "Petikan dasar dan tuntutan yang disemak",
        scopeNote: "Kerja tanpa pengawasan membenarkan AI dengan pengisytiharan; arahan tugasan khusus tetap terpakai.",
        cta: "Lihat panduan NUS",
        thumbSrc: "/assets/home-v4/nus-thumb.jpg",
        thumbAlt: "Ilustrasi semak, guna dan perakukan penggunaan AI di NUS"
      }
    ],
    viewGuide: "Lihat panduan",
    recentChecksHeading: "Semakan terkini",
    recentChecksSubtitle: "Tarikh pengesahan rekod daripada portal rasmi universiti, berbeza daripada tarikh penerbitan dasar.",
    viewChangesLog: "Lihat log perubahan dasar →",
    checkedDatePrefix: "Disemak pada",
    claimsCountSuffix: "tuntutan",
    noDate: "Tarikh tidak tersedia",
    regionsAndToolsHeading: "Layari mengikut rantau dan alat",
    regionsAndToolsSubtitle: "Terokai dasar mengikut bidang kuasa atau cari garis panduan bagi perkhidmatan AI tertentu.",
    regionsGroupTitle: "Wilayah",
    toolsGroupTitle: "Alat",
    institutionalDirectoriesTitle: "Direktori Institusi",
    unitedStatesLabel: "Amerika Syarikat",
    unitedKingdomLabel: "United Kingdom",
    allRegionsDirectory: "Direktori semua rantau →",
    aiToolsDirectory: "Direktori alat AI →",
    rankingsDirectory: "Indeks kedudukan universiti →",
    rankingsNote: "Direktori carian mengikut kohort institusi, bukan penilaian kualiti dasar universiti.",
    openDataHeading: "Sumber, metodologi dan data terbuka",
    sourcesPillarTitle: "Sumber rasmi dan pengesahan",
    sourcesPillarText: "Rekod merangkumi halaman web rasmi universiti, peraturan PDF, petikan bukti, status semakan dan tarikh semakan terakhir.",
    sourcesLink: "Sumber rasmi",
    methodologyLink: "Metodologi",
    citationPillarTitle: "Petikan akademik dan kebolehulangan",
    citationPillarText: "Rekod menyediakan metadata petikan berstruktur, URL sumber dan versi petikan untuk penyelidikan akademik dan institusi.",
    citationLink: "Panduan petikan",
    developerPillarTitle: "Set data terbuka dan API pembangun",
    developerPillarText: "Akses set data JSON awam, titik akhir REST dan pelayan MCP. Metadata berstruktur disediakan secara percuma di bawah CC-BY-4.0.",
    rightsNote: "Dokumen dasar rasmi dan cap dagangan institusi kekal sebagai hak milik intelek universiti masing-masing.",
    datasetsLink: "Set data awam",
    apiLink: "Rujukan API",
    mcpLink: "Pelayan MCP",
    faqHeading: "Soalan lazim",
    faqItems: [
      {
        question: "Bagaimanakah saya mencari dasar AI universiti saya?",
        answer: "Masukkan nama atau singkatan universiti anda di bar carian di atas, atau layari mengikut negara dan rantau."
      },
      {
        question: "Adakah penjejak ini menyatakan sama ada AI dibenarkan atau dilarang secara umum?",
        answer: "Tidak. Dasar AI bergantung pada universiti, fakulti dan pensyarah kursus khusus anda. Sentiasa semak sukatan pelajaran anda."
      },
      {
        question: "Bagaimanakah maklumat dasar disahkan?",
        answer: "Rekod disahkan berdasarkan garis panduan rasmi universiti yang diterbitkan melalui aliran kerja semakan ejen dan manusia, merekodkan URL sumber, status semakan dan petikan bukti."
      },
      {
        question: "Adakah dokumen dasar asal bebas untuk digunakan semula?",
        answer: "Metadata berstruktur dilesenkan di bawah CC-BY-4.0; teks dasar asal dan logo universiti kekal dilindungi hak cipta universiti masing-masing."
      }
    ]
  }
};

export function getHomeV4Copy(locale: SupportedLocale): HomeV4Copy {
  return copyByLocale[locale] ?? copyByLocale.en;
}
