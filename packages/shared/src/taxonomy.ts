export const aiTools = [
  "chatgpt",
  "codex",
  "claude",
  "deepseek",
  "gemini",
  "notebooklm",
  "microsoft_copilot",
  "microsoft_copilot_for_m365",
  "github_copilot",
  "adobe_firefly",
  "aws_bedrock",
  "aws_sagemaker",
  "azure_openai",
  "google_vertex_ai",
  "google_ai_studio",
  "google_workspace_studio",
  "salesforce_einstein",
  "zoom_ai_companion",
  "perplexity",
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
  claude: {
    slug: "claude",
    label: "Claude / Anthropic",
    provider: "Anthropic",
    aliases: [
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
  perplexity: {
    slug: "perplexity",
    label: "Perplexity",
    provider: "Perplexity",
    aliases: ["Perplexity"],
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
