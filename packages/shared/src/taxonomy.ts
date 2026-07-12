export const aiTools = [
  "chatgpt",
  "codex",
  "dalle",
  "claude",
  "deepseek",
  "gemini",
  "notebooklm",
  "microsoft_copilot",
  "microsoft_copilot_for_m365",
  "github_copilot",
  "adobe_creative_cloud",
  "adobe_express",
  "adobe_firefly",
  "aws_bedrock",
  "aws_sagemaker",
  "azure_openai",
  "google_vertex_ai",
  "google_ai_studio",
  "google_ai_pro",
  "google_workspace_studio",
  "salesforce_einstein",
  "zoom_ai_companion",
  "openai_api",
  "mistral",
  "perplexity",
  "perplexity_comet",
  "chatgpt_atlas",
  "openclaw",
  "grammarly",
  "slack_ai",
  "cisco_ai_assistant",
  "webex_ai",
  "slido_ai",
  "synthesia",
  "read_ai",
  "turnitin_ai_detection",
  "portkey",
  "azure_ai",
  "azure_ai_foundry",
  "infomaniak_ai_tools",
  "msty",
  "ollama",
  "grok",
  "llama",
  "lumo",
  "publicai",
  "answerthis",
  "asta",
  "elicit",
  "scispace",
  "rayyan",
  "research_rabbit",
  "customgpt",
  "deepl",
  "lens",
  "dimensions",
  "openalex",
  "matilda",
  "cogniti",
  "contact_north_teachers_assistant_pro",
  "contact_north_ai_tutor_pro",
  "web_of_science_research_assistant",
  "power_bi_copilot",
  "copilot_studio",
  "teams_premium",
  "microsoft_powerpoint",
  "miro",
  "arcgis",
  "endnote",
  "panopto",
  "linkedin_learning_ai",
  "cnki_ai_academic",
  "cnki_ai_enhanced_search",
  "aminer_ai",
  "mindlogic_infomi",
  "naver_clova_studio",
  "yunsiku_humanities_qa",
  "ai_chat_playground",
  "summon_research_assistant",
  "scite_ai",
  "scopus_ai",
  "kimi",
  "glm",
  "minimax",
  "doubao",
  "qwen",
  "ernie",
  "hunyuan",
  "yuanbao",
  "self_deploy",
  "institutional_ai_service",
  "unspecified_ai_tool"
] as const;

export const documentStatuses = [
  "university_wide_policy",
  "specific_unit_policy_or_guidance",
  "external_policy_or_guidance",
  "no_policy",
  "inaccessible"
] as const;

export const policyAuthorities = [
  "university_wide",
  "faculty_or_school",
  "department",
  "course_level",
  "it_or_security_office",
  "library",
  "teaching_and_learning_center",
  "research_office",
  "procurement_or_legal"
] as const;

export const aiServiceStatuses = [
  "institutionally_licensed_or_procured",
  "third_party_service",
  "self_hosted_system",
  "restricted_or_prohibited",
  "no_specific_ai_service_named"
] as const;

export const serviceTreatments = [
  "allowed",
  "conditionally_allowed",
  "restricted_or_blocked",
  "not_mentioned"
] as const;

export const governanceThemes = [
  "data_entry",
  "privacy",
  "copyright",
  "academic_integrity",
  "teaching",
  "research",
  "security_review",
  "login_or_authentication",
  "procurement"
] as const;

export const audiences = [
  "students",
  "faculty",
  "staff",
  "researchers",
  "administrators"
] as const;

export const academicContexts = [
  "assignment",
  "exam",
  "thesis",
  "research",
  "teaching_preparation",
  "administrative_work"
] as const;

export const dataSensitivities = [
  "public_data",
  "internal_data",
  "student_records",
  "personally_identifiable_information",
  "confidential_research",
  "regulated_data"
] as const;

export const evidenceQualities = [
  "official_source",
  "archived_official_source",
  "pdf",
  "third_party_mention",
  "unclear"
] as const;

export const reviewStates = [
  "machine_extracted",
  "agent_reviewed",
  "human_reviewed",
  "needs_review"
] as const;

export type AiToolSlug = (typeof aiTools)[number];

export interface AiToolCatalogEntry {
  slug: AiToolSlug;
  label: string;
  provider: string;
  aliases: readonly string[];
  category:
    | "commercial_assistant"
    | "cloud_platform"
    | "office_suite"
    | "self_hosted_platform"
    | "generic_bucket"
    | "china_market";
}

export const aiToolRegistry: Record<AiToolSlug, AiToolCatalogEntry> = {
  chatgpt: {
    slug: "chatgpt",
    label: "ChatGPT / OpenAI",
    provider: "OpenAI",
    aliases: [
      "Open AI ChatGPT",
      "OpenAI ChatGPT",
      "ChatGPT Edu",
      "ChatGPT Enterprise",
      "ChatGPT",
      "Chat GPT"
    ],
    category: "commercial_assistant"
  },
  codex: {
    slug: "codex",
    label: "Codex",
    provider: "OpenAI",
    aliases: ["OpenAI Codex", "Codex"],
    category: "commercial_assistant"
  },
  dalle: {
    slug: "dalle",
    label: "DALL-E / OpenAI",
    provider: "OpenAI",
    aliases: ["DALL-E", "DALL·E", "DALL∙E", "DALL E"],
    category: "commercial_assistant"
  },
  claude: {
    slug: "claude",
    label: "Claude / Anthropic",
    provider: "Anthropic",
    aliases: [
      "Anthropic Claude Standard",
      "Anthropic Claude Premium",
      "Anthropic Claude",
      "Claude for Enterprise",
      "Claude for Work",
      "Claude Pro",
      "Claude"
    ],
    category: "commercial_assistant"
  },
  deepseek: {
    slug: "deepseek",
    label: "DeepSeek",
    provider: "DeepSeek",
    aliases: ["DeepSeek"],
    category: "china_market"
  },
  gemini: {
    slug: "gemini",
    label: "Gemini / Google AI",
    provider: "Google",
    aliases: [
      "Google Gemini",
      "Gemini for Google Workspace",
      "Gemini for Workspace",
      "Gemini"
    ],
    category: "office_suite"
  },
  notebooklm: {
    slug: "notebooklm",
    label: "NotebookLM / Google",
    provider: "Google",
    aliases: ["Google NotebookLM", "NotebookLM", "Notebook LM"],
    category: "office_suite"
  },
  microsoft_copilot: {
    slug: "microsoft_copilot",
    label: "Microsoft Copilot",
    provider: "Microsoft",
    aliases: ["Microsoft Copilot Chat", "Microsoft Copilot", "Copilot Chat", "Copilot"],
    category: "office_suite"
  },
  microsoft_copilot_for_m365: {
    slug: "microsoft_copilot_for_m365",
    label: "Microsoft Copilot for M365",
    provider: "Microsoft",
    aliases: [
      "Microsoft 365 Copilot",
      "Microsoft Copilot for M365",
      "Copilot for M365",
      "M365 Copilot",
      "Copilot for Microsoft 365"
    ],
    category: "office_suite"
  },
  github_copilot: {
    slug: "github_copilot",
    label: "GitHub Copilot",
    provider: "GitHub / Microsoft",
    aliases: ["GitHub Copilot", "Copilot for GitHub"],
    category: "commercial_assistant"
  },
  adobe_creative_cloud: {
    slug: "adobe_creative_cloud",
    label: "Adobe Creative Cloud",
    provider: "Adobe",
    aliases: ["Adobe Creative Cloud", "Adobe Creative Cloud software"],
    category: "commercial_assistant"
  },
  adobe_express: {
    slug: "adobe_express",
    label: "Adobe Express",
    provider: "Adobe",
    aliases: ["Adobe Express"],
    category: "commercial_assistant"
  },
  adobe_firefly: {
    slug: "adobe_firefly",
    label: "Adobe Firefly",
    provider: "Adobe",
    aliases: ["Adobe Firefly"],
    category: "commercial_assistant"
  },
  aws_bedrock: {
    slug: "aws_bedrock",
    label: "AWS Bedrock",
    provider: "Amazon Web Services",
    aliases: ["AWS Bedrock", "Amazon Bedrock"],
    category: "cloud_platform"
  },
  aws_sagemaker: {
    slug: "aws_sagemaker",
    label: "AWS SageMaker",
    provider: "Amazon Web Services",
    aliases: ["AWS SageMaker", "AWS Sagemaker", "Amazon SageMaker", "SageMaker"],
    category: "cloud_platform"
  },
  azure_openai: {
    slug: "azure_openai",
    label: "Azure OpenAI",
    provider: "Microsoft",
    aliases: ["Azure OpenAI", "Azure OpenAI Service"],
    category: "cloud_platform"
  },
  google_vertex_ai: {
    slug: "google_vertex_ai",
    label: "Google Vertex AI",
    provider: "Google",
    aliases: ["Google Vertex", "Vertex AI", "Google Vertex AI"],
    category: "cloud_platform"
  },
  google_ai_studio: {
    slug: "google_ai_studio",
    label: "Google AI Studio",
    provider: "Google",
    aliases: ["Google AI Studio", "AI Studio"],
    category: "cloud_platform"
  },
  google_ai_pro: {
    slug: "google_ai_pro",
    label: "Google AI Pro",
    provider: "Google",
    aliases: ["Google AI Pro", "Google AI Pro Edu"],
    category: "office_suite"
  },
  google_workspace_studio: {
    slug: "google_workspace_studio",
    label: "Google Workspace Studio",
    provider: "Google",
    aliases: ["Google Workspace Studio", "Workspace Studio"],
    category: "office_suite"
  },
  salesforce_einstein: {
    slug: "salesforce_einstein",
    label: "Salesforce Einstein",
    provider: "Salesforce",
    aliases: ["Salesforce Einstein"],
    category: "commercial_assistant"
  },
  zoom_ai_companion: {
    slug: "zoom_ai_companion",
    label: "Zoom AI Companion",
    provider: "Zoom",
    aliases: ["Zoom AI Companion"],
    category: "commercial_assistant"
  },
  openai_api: {
    slug: "openai_api",
    label: "OpenAI API",
    provider: "OpenAI",
    aliases: ["OpenAI API", "OpenAI API for Education"],
    category: "cloud_platform"
  },
  mistral: {
    slug: "mistral",
    label: "Mistral",
    provider: "Mistral AI",
    aliases: ["Mistral AI", "Mistral"],
    category: "commercial_assistant"
  },
  perplexity: {
    slug: "perplexity",
    label: "Perplexity",
    provider: "Perplexity",
    aliases: ["Perplexity"],
    category: "commercial_assistant"
  },
  perplexity_comet: {
    slug: "perplexity_comet",
    label: "Comet",
    provider: "Perplexity",
    aliases: ["Comet", "Perplexity Comet", "Comet Browser"],
    category: "commercial_assistant"
  },
  chatgpt_atlas: {
    slug: "chatgpt_atlas",
    label: "ChatGPT Atlas",
    provider: "OpenAI",
    aliases: ["ChatGPT Atlas", "Atlas"],
    category: "commercial_assistant"
  },
  openclaw: {
    slug: "openclaw",
    label: "OpenClaw",
    provider: "OpenClaw",
    aliases: ["OpenClaw"],
    category: "commercial_assistant"
  },
  grammarly: {
    slug: "grammarly",
    label: "Grammarly",
    provider: "Grammarly",
    aliases: ["Grammarly", "Grammarly for Education"],
    category: "commercial_assistant"
  },
  slack_ai: {
    slug: "slack_ai",
    label: "Slack AI",
    provider: "Slack",
    aliases: ["Slack AI"],
    category: "office_suite"
  },
  cisco_ai_assistant: {
    slug: "cisco_ai_assistant",
    label: "Cisco AI Assistant",
    provider: "Cisco",
    aliases: ["Cisco AI Assistant", "Cisco AI アシスタント"],
    category: "office_suite"
  },
  webex_ai: {
    slug: "webex_ai",
    label: "Webex AI",
    provider: "Cisco",
    aliases: ["Webex AI"],
    category: "office_suite"
  },
  slido_ai: {
    slug: "slido_ai",
    label: "Slido AI",
    provider: "Cisco",
    aliases: ["Slido AI"],
    category: "office_suite"
  },
  synthesia: {
    slug: "synthesia",
    label: "Synthesia",
    provider: "Synthesia",
    aliases: ["Synthesia"],
    category: "commercial_assistant"
  },
  read_ai: {
    slug: "read_ai",
    label: "Read.AI",
    provider: "Read AI",
    aliases: ["Read.AI", "Read AI"],
    category: "commercial_assistant"
  },
  turnitin_ai_detection: {
    slug: "turnitin_ai_detection",
    label: "Turnitin AI Detection",
    provider: "Turnitin",
    aliases: ["Turnitin AI detection tool", "Turnitin AI Detection"],
    category: "commercial_assistant"
  },
  portkey: {
    slug: "portkey",
    label: "Portkey",
    provider: "Portkey",
    aliases: ["Portkey"],
    category: "cloud_platform"
  },
  azure_ai: {
    slug: "azure_ai",
    label: "Azure AI",
    provider: "Microsoft",
    aliases: ["Azure AI"],
    category: "cloud_platform"
  },
  azure_ai_foundry: {
    slug: "azure_ai_foundry",
    label: "Azure AI Foundry",
    provider: "Microsoft",
    aliases: ["Azure AI Foundry"],
    category: "cloud_platform"
  },
  infomaniak_ai_tools: {
    slug: "infomaniak_ai_tools",
    label: "Infomaniak AI Tools",
    provider: "Infomaniak",
    aliases: ["Infomaniak AI tools"],
    category: "cloud_platform"
  },
  msty: {
    slug: "msty",
    label: "Msty",
    provider: "Msty",
    aliases: ["Msty"],
    category: "commercial_assistant"
  },
  ollama: {
    slug: "ollama",
    label: "Ollama",
    provider: "Ollama",
    aliases: ["Ollama"],
    category: "commercial_assistant"
  },
  grok: {
    slug: "grok",
    label: "Grok",
    provider: "xAI",
    aliases: ["Grok", "Grok (xAI)"],
    category: "commercial_assistant"
  },
  llama: {
    slug: "llama",
    label: "Llama",
    provider: "Meta",
    aliases: ["Llama", "Llama (Meta)"],
    category: "commercial_assistant"
  },
  lumo: {
    slug: "lumo",
    label: "Lumo",
    provider: "Proton",
    aliases: ["Lumo", "Lumo (Proton)"],
    category: "commercial_assistant"
  },
  publicai: {
    slug: "publicai",
    label: "PublicAI",
    provider: "PublicAI",
    aliases: ["PublicAI", "PublicAI (Apertus interface)"],
    category: "commercial_assistant"
  },
  answerthis: {
    slug: "answerthis",
    label: "AnswerThis",
    provider: "AnswerThis",
    aliases: ["AnswerThis"],
    category: "commercial_assistant"
  },
  asta: {
    slug: "asta",
    label: "Asta",
    provider: "Allen Institute for AI",
    aliases: ["Asta"],
    category: "commercial_assistant"
  },
  elicit: {
    slug: "elicit",
    label: "Elicit",
    provider: "Elicit",
    aliases: ["Elicit"],
    category: "commercial_assistant"
  },
  scispace: {
    slug: "scispace",
    label: "SciSpace",
    provider: "SciSpace",
    aliases: ["SciSpace", "Scispace"],
    category: "commercial_assistant"
  },
  rayyan: {
    slug: "rayyan",
    label: "Rayyan",
    provider: "Rayyan",
    aliases: ["Rayyan"],
    category: "commercial_assistant"
  },
  research_rabbit: {
    slug: "research_rabbit",
    label: "Research Rabbit",
    provider: "Research Rabbit",
    aliases: ["Research Rabbit", "ResearchRabbit"],
    category: "commercial_assistant"
  },
  customgpt: {
    slug: "customgpt",
    label: "CustomGPT",
    provider: "OpenAI",
    aliases: ["CustomGPT", "CustomGPT (OpenAI GPTs)"],
    category: "commercial_assistant"
  },
  deepl: {
    slug: "deepl",
    label: "DeepL",
    provider: "DeepL",
    aliases: ["DeepL"],
    category: "commercial_assistant"
  },
  lens: {
    slug: "lens",
    label: "Lens",
    provider: "The Lens",
    aliases: ["Lens"],
    category: "commercial_assistant"
  },
  dimensions: {
    slug: "dimensions",
    label: "Dimensions",
    provider: "Digital Science",
    aliases: ["Dimensions"],
    category: "commercial_assistant"
  },
  openalex: {
    slug: "openalex",
    label: "OpenAlex",
    provider: "OurResearch",
    aliases: ["OpenAlex"],
    category: "commercial_assistant"
  },
  matilda: {
    slug: "matilda",
    label: "Matilda",
    provider: "Matilda",
    aliases: ["Matilda"],
    category: "commercial_assistant"
  },
  cogniti: {
    slug: "cogniti",
    label: "Cogniti",
    provider: "Cogniti",
    aliases: ["Cogniti"],
    category: "self_hosted_platform"
  },
  contact_north_teachers_assistant_pro: {
    slug: "contact_north_teachers_assistant_pro",
    label: "Contact North Teacher's Assistant Pro",
    provider: "Contact North",
    aliases: ["Contact North Teacher's Assistant Pro", "Teacher's Assistant Pro"],
    category: "commercial_assistant"
  },
  contact_north_ai_tutor_pro: {
    slug: "contact_north_ai_tutor_pro",
    label: "Contact North AI Tutor Pro",
    provider: "Contact North",
    aliases: ["Contact North AI Tutor Pro", "AI Tutor Pro"],
    category: "commercial_assistant"
  },
  web_of_science_research_assistant: {
    slug: "web_of_science_research_assistant",
    label: "Web of Science Research Assistant",
    provider: "Clarivate",
    aliases: ["Web of Science Research Assistant", "WoS Research Assistant Tool"],
    category: "commercial_assistant"
  },
  power_bi_copilot: {
    slug: "power_bi_copilot",
    label: "Power BI Copilot",
    provider: "Microsoft",
    aliases: ["Power BI Copilot"],
    category: "office_suite"
  },
  copilot_studio: {
    slug: "copilot_studio",
    label: "Microsoft Copilot Studio",
    provider: "Microsoft",
    aliases: ["Microsoft 365 Copilot Studio", "Microsoft Copilot Studio", "Copilot Studio"],
    category: "office_suite"
  },
  teams_premium: {
    slug: "teams_premium",
    label: "Microsoft Teams Premium",
    provider: "Microsoft",
    aliases: ["Microsoft Teams Premium", "Teams Premium"],
    category: "office_suite"
  },
  microsoft_powerpoint: {
    slug: "microsoft_powerpoint",
    label: "Microsoft PowerPoint",
    provider: "Microsoft",
    aliases: ["Microsoft PowerPoint", "PowerPoint Designer", "Presentation Coach"],
    category: "office_suite"
  },
  miro: {
    slug: "miro",
    label: "Miro",
    provider: "Miro",
    aliases: ["Miro"],
    category: "commercial_assistant"
  },
  arcgis: {
    slug: "arcgis",
    label: "ArcGIS",
    provider: "Esri",
    aliases: ["ArcGIS", "ArcGIS Pro"],
    category: "commercial_assistant"
  },
  endnote: {
    slug: "endnote",
    label: "EndNote",
    provider: "Clarivate",
    aliases: ["EndNote", "EndNote 2025"],
    category: "commercial_assistant"
  },
  panopto: {
    slug: "panopto",
    label: "Panopto",
    provider: "Panopto",
    aliases: ["Panopto"],
    category: "commercial_assistant"
  },
  linkedin_learning_ai: {
    slug: "linkedin_learning_ai",
    label: "LinkedIn Learning AI",
    provider: "LinkedIn",
    aliases: [
      "LinkedIn Learning AI Coaching",
      "LinkedIn Learning AI Coaching and Role Play",
      "LinkedIn Learning AI Role Play"
    ],
    category: "commercial_assistant"
  },
  cnki_ai_academic: {
    slug: "cnki_ai_academic",
    label: "CNKI AI Academic Research Assistant",
    provider: "CNKI",
    aliases: ["CNKI AI学术研究助手", "CNKI AI Academic Research Assistant"],
    category: "china_market"
  },
  cnki_ai_enhanced_search: {
    slug: "cnki_ai_enhanced_search",
    label: "CNKI AI Enhanced Search",
    provider: "CNKI",
    aliases: ["知网总库AI增强检索", "CNKI AI Enhanced Search"],
    category: "china_market"
  },
  aminer_ai: {
    slug: "aminer_ai",
    label: "AMiner AI Research Assistant",
    provider: "AMiner",
    aliases: ["AMiner AI科研助手", "AMiner AI Research Assistant"],
    category: "china_market"
  },
  mindlogic_infomi: {
    slug: "mindlogic_infomi",
    label: "Mindlogic Infomi",
    provider: "Mindlogic",
    aliases: ["마인드로직 인포미", "Mindlogic Infomi", "Infomi"],
    category: "commercial_assistant"
  },
  naver_clova_studio: {
    slug: "naver_clova_studio",
    label: "NAVER CLOVA Studio",
    provider: "NAVER",
    aliases: ["네이버 클로버 스튜디오", "네이버 클로바 스튜디오", "NAVER CLOVA Studio", "CLOVA Studio"],
    category: "commercial_assistant"
  },
  yunsiku_humanities_qa: {
    slug: "yunsiku_humanities_qa",
    label: "Yun Siku Intelligent Q&A",
    provider: "Yun Siku",
    aliases: ["云四库智能问答系统", "Yun Siku Intelligent Q&A"],
    category: "china_market"
  },
  ai_chat_playground: {
    slug: "ai_chat_playground",
    label: "AI Chat Playground",
    provider: "MathWorks",
    aliases: ["AI Chat Playground"],
    category: "commercial_assistant"
  },
  summon_research_assistant: {
    slug: "summon_research_assistant",
    label: "Summon Research Assistant",
    provider: "Summon",
    aliases: ["Summon Research Assistant", "Summon Research Assistant（BETA版)"],
    category: "commercial_assistant"
  },
  scite_ai: {
    slug: "scite_ai",
    label: "Scite",
    provider: "Scite",
    aliases: ["Scite AI", "Scite"],
    category: "commercial_assistant"
  },
  scopus_ai: {
    slug: "scopus_ai",
    label: "Scopus AI",
    provider: "Elsevier",
    aliases: ["Scopus AI"],
    category: "commercial_assistant"
  },
  kimi: {
    slug: "kimi",
    label: "Kimi",
    provider: "Moonshot AI",
    aliases: ["Kimi"],
    category: "china_market"
  },
  glm: {
    slug: "glm",
    label: "GLM / Zhipu AI",
    provider: "Zhipu AI",
    aliases: ["ChatGLM", "GLM-4", "GLM 4", "GLM"],
    category: "china_market"
  },
  minimax: {
    slug: "minimax",
    label: "MiniMax",
    provider: "MiniMax",
    aliases: ["MiniMax"],
    category: "china_market"
  },
  doubao: {
    slug: "doubao",
    label: "Doubao",
    provider: "ByteDance",
    aliases: ["Doubao"],
    category: "china_market"
  },
  qwen: {
    slug: "qwen",
    label: "Qwen",
    provider: "Alibaba",
    aliases: ["Qwen"],
    category: "china_market"
  },
  ernie: {
    slug: "ernie",
    label: "ERNIE",
    provider: "Baidu",
    aliases: ["ERNIE"],
    category: "china_market"
  },
  hunyuan: {
    slug: "hunyuan",
    label: "Hunyuan",
    provider: "Tencent",
    aliases: ["Hunyuan"],
    category: "china_market"
  },
  yuanbao: {
    slug: "yuanbao",
    label: "Yuanbao",
    provider: "Tencent",
    aliases: ["Tencent Yuanbao", "Yuanbao"],
    category: "china_market"
  },
  self_deploy: {
    slug: "self_deploy",
    label: "University-hosted platform",
    provider: "University",
    aliases: [
      "Harvard AI Sandbox",
      "nebulaONE",
      "Parley",
      "dAIsy",
      "Stanford AI Playground",
      "U-M GPT",
      "U-M Maizey",
      "U-M GPT Toolkit",
      "HKUST GenAI Platform",
      "Open WebUI",
      "AI Chatbot for HKUST Drupal Platform",
      "HKUST Generative AI API Service",
      "DeepSeek 本地版",
      "AI 应用平台",
      "UvA AI Chat",
      "PolyU GenAI",
      "DukeGPT",
      "MyGPT Builder",
      "AI Gateway",
      "CityUHK Chatbot",
      "CityUHK IT Chatbot",
      "exaBase Generative AI",
      "kWhisper",
      "TritonGPT",
      "UT Spark",
      "UT Sage",
      "Illinois Chat",
      "Illinois ChatGPT",
      "YoKI",
      "heiBOT-IT",
      "AI Playground"
    ],
    category: "self_hosted_platform"
  },
  institutional_ai_service: {
    slug: "institutional_ai_service",
    label: "Institutional AI service",
    provider: "University",
    aliases: [
      "institutional AI service",
      "institutional AI platform",
      "university-hosted AI platform",
      "managed generative AI platform",
      "managed AI platform",
      "campus AI service",
      "campus AI platform",
      "secure AI platform"
    ],
    category: "generic_bucket"
  },
  unspecified_ai_tool: {
    slug: "unspecified_ai_tool",
    label: "Unspecified AI tool",
    provider: "Unknown",
    aliases: [],
    category: "generic_bucket"
  }
} as const;

export const aiToolCatalog = aiTools.map((slug) => aiToolRegistry[slug]);

export interface ToolMention {
  tool: AiToolSlug;
  rawToolName: string;
  provider: string;
  label: string;
}

export function getAiToolCatalogEntry(tool: AiToolSlug): AiToolCatalogEntry {
  return aiToolRegistry[tool];
}

export function findToolMentions(text: string): ToolMention[] {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const mentions: ToolMention[] = [];
  const seen = new Set<AiToolSlug>();

  for (const entry of aiToolCatalog) {
    if (!entry.aliases.length) continue;

    const match = findBestAliasMatch(normalizedText, entry.aliases);
    if (!match || seen.has(entry.slug)) continue;

    seen.add(entry.slug);
    mentions.push({
      tool: entry.slug,
      rawToolName: match,
      provider: entry.provider,
      label: entry.label
    });
  }

  return mentions;
}

function findBestAliasMatch(text: string, aliases: readonly string[]): string | undefined {
  for (const alias of aliases) {
    const pattern = aliasToRegExp(alias);
    const match = text.match(pattern);
    if (match?.[0]) return match[0];
  }

  return undefined;
}

function aliasToRegExp(alias: string): RegExp {
  const escapedParts = alias
    .trim()
    .split(/\s+/)
    .map((part) => escapeRegExp(part))
    .join("\\s+");

  return new RegExp(`\\b${escapedParts}\\b`, "i");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
