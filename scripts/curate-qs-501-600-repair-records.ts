import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

type Json = Record<string, any>;
type Spec = {
  qsRow: number;
  urlIncludes: string;
  tool: string;
  rawToolName: string;
  description: string;
  endorsementType: string;
  institutionalRelationship: string;
  accessAudience: string;
  accessStatus: string;
  howToObtain: string;
  costToUser: string;
  evidenceQuotes: string[];
};

const RECORDS_PATH = "staging/ai-tools/audits/qs-501-600-confirmed-records-20260718-009.json";
const REPAIR_PATH = "staging/ai-tools/audits/qs-501-600-repair-discovery-20260718-009.json";
const LEDGER_PATH = "staging/ai-tools/audits/qs-501-600-ai-tools-audit-ledger-20260718-009.json";

const specs: Spec[] = [
  {
    qsRow: 509, urlIncludes: "/library/artificial-intelligence-in-information-retrieval", tool: "primo_research_assistant", rawToolName: "UEF Primo AI Research Assistant",
    description: "UEF provides its Primo AI Research Assistant through UEF credentials or a library card.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "Integrated into UEF Primo.", accessAudience: "UEF community and registered library-card users.", accessStatus: "Current official library service.", howToObtain: "Log into UEF Primo with UEF credentials or a library card.", costToUser: "Included with eligible UEF Primo access.",
    evidenceQuotes: ["The UEF Primo AI Research Assistant can only be used by logging into UEF Primo with UEF credentials (uefians) or with a library card (other users)."]
  },
  {
    qsRow: 509, urlIncludes: "/article/artificial-intelligence-in-information-retrieval-scopus-ai", tool: "scopus_ai", rawToolName: "Scopus AI",
    description: "UEF Library has acquired Scopus AI and directs users through UEF Primo so institutional access remains active.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "UEF Library-acquired database AI tool.", accessAudience: "Eligible UEF library users.", accessStatus: "Current official library service.", howToObtain: "Open Scopus through UEF Primo.", costToUser: "Included with eligible UEF library access.",
    evidenceQuotes: ["UEF library has acquired tools for generative AI integrated into scientific databases: Scopus AI in Scopus and Web of Science Research Assistant in the Web of Science database."]
  },
  {
    qsRow: 509, urlIncludes: "/article/artificial-intelligence-in-information-retrieval-scopus-ai", tool: "web_of_science_research_assistant", rawToolName: "Web of Science Research Assistant",
    description: "UEF Library has acquired Web of Science Research Assistant and provides it through UEF Primo access.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "UEF Library-acquired database AI tool.", accessAudience: "Eligible UEF library users.", accessStatus: "Current official library service.", howToObtain: "Open Web of Science through UEF Primo.", costToUser: "Included with eligible UEF library access.",
    evidenceQuotes: ["UEF library has acquired tools for generative AI integrated into scientific databases: Scopus AI in Scopus and Web of Science Research Assistant in the Web of Science database."]
  },
  {
    qsRow: 509, urlIncludes: "/library/artificial-intelligence-in-information-retrieval", tool: "microsoft_copilot", rawToolName: "Microsoft 365 Copilot Enterprise",
    description: "UEF recommends its licensed Microsoft 365 Copilot Enterprise service and requires UEF Microsoft-account login.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "UEF Microsoft 365 licence with data-processing agreement.", accessAudience: "UEF Microsoft-account holders.", accessStatus: "Current official library guidance.", howToObtain: "Log in through the UEF Microsoft account or UEF Intra link.", costToUser: "Included for eligible UEF account holders.",
    evidenceQuotes: ["Along with UEF Primo, Scopus and Web of Science AI tools, such a suitable application is Microsoft 365 Copilot Enterprise-version, which needs to be logged in through your UEF Microsoft account."]
  },
  {
    qsRow: 510, urlIncludes: "/ai/aihub", tool: "institutional_ai_service", rawToolName: "UT AI Hub",
    description: "UT Knoxville operates a private, campus-supported multi-model AI Hub for active faculty, staff, and students.", endorsementType: "self_hosted_system", institutionalRelationship: "University-operated multi-model AI platform.", accessAudience: "Active UT faculty, staff, and students.", accessStatus: "Current OIT-supported service.", howToObtain: "Sign in at the UT AI Hub with a UT Microsoft account.", costToUser: "Campus-supported access.",
    evidenceQuotes: ["Active faculty, staff, and students have access to the UT AI Hub.", "Once the hub opens, you’ll log in with your UT Microsoft account."]
  },
  ...[
    ["chatgpt", "OpenAI ChatGPT", "OpenAI ChatGPT: A general-purpose assistant"],
    ["claude", "Anthropic Claude", "Anthropic Claude Sonnet"],
    ["llama", "Meta Llama", "Meta Llama"],
    ["grok", "xAI Grok", "xAI Grok"],
    ["gemini", "Google Gemini", "Google Gemini"],
    ["perplexity", "Perplexity", "Manually select the AI model that you want using a drop-down window. (ex. Perplexity)"]
  ].map(([tool, rawToolName, productQuote]) => ({
    qsRow: 510, urlIncludes: "/ai/aihub", tool, rawToolName,
    description: `${rawToolName} is available inside UT Knoxville's private, campus-supported AI Hub.`, endorsementType: "self_hosted_system", institutionalRelationship: "Model delivered through the university-operated UT AI Hub.", accessAudience: "Active UT faculty, staff, and students.", accessStatus: "Current OIT-supported service.", howToObtain: "Open the UT AI Hub and sign in with a UT Microsoft account.", costToUser: "Campus-supported access.", evidenceQuotes: ["Active faculty, staff, and students have access to the UT AI Hub.", productQuote]
  })),
  {
    qsRow: 513, urlIncludes: "p=5303879", tool: "microsoft_copilot", rawToolName: "Microsoft Copilot",
    description: "Ulster University Library directs users to Microsoft Copilot using their university account.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "University-account Microsoft Copilot access.", accessAudience: "Ulster University account holders.", accessStatus: "Current official library AI-tools guide.", howToObtain: "Open Copilot and sign in using an Ulster University account.", costToUser: "No additional user charge is stated.",
    evidenceQuotes: ["Copilot", "Sign in using your university account."]
  },
  {
    qsRow: 525, urlIncludes: "career.oregonstate.edu/resumes-cvs-cover-letters/ai-tools-career-development", tool: "institutional_ai_service", rawToolName: "OSU AI Career Assistant",
    description: "Oregon State operates a custom ChatGPT-based career assistant trained on OSU career resources.", endorsementType: "self_hosted_system", institutionalRelationship: "OSU-specific custom AI service.", accessAudience: "OSU career assistants supporting advising sessions.", accessStatus: "Launched in April 2025.", howToObtain: "Use through OSU Career Development advising workflows.", costToUser: "Institution-operated service.",
    evidenceQuotes: ["Launched in April 2025, the OSU AI Career Assistant is custom AI tool based on Open AI’s ChatGPT platform and trained on OSU-specific career resources.", "The OSU AI Career Assistant is a supplemental tool that career assistants can use to augment their one-on-one career advising sessions."]
  },
  {
    qsRow: 525, urlIncludes: "technology.oregonstate.edu/all-stories/start-year-copilot", tool: "microsoft_copilot", rawToolName: "Copilot Chat for Web",
    description: "Oregon State provides Copilot Chat for Web to all faculty, staff, and enrolled students as an approved generative AI tool.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "OSU-approved Microsoft AI service.", accessAudience: "All OSU faculty, staff, and enrolled students.", accessStatus: "Current official technology guidance.", howToObtain: "Sign in to Microsoft 365 with OSU ONID credentials.", costToUser: "Included for eligible OSU users.",
    evidenceQuotes: ["Copilot forWeb Link is external is available to all faculty, staff, and enrolled students at Oregon State University as part of OSU’s approved generative AI tools.", "Sign in with your OSU credentials (ONID) to Microsoft365 Link is external."]
  },
  {
    qsRow: 529, urlIncludes: "/resources/current-students/software", tool: "chatgpt", rawToolName: "ChatGPT Education",
    description: "The University of Missouri System purchased ChatGPT Education seats with enterprise features and institutional data protections for Missouri S&T users.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "UM System-purchased ChatGPT Education plan.", accessAudience: "Missouri S&T users whose units purchase a seat.", accessStatus: "Current official software catalogue.", howToObtain: "Submit an IT ticket to purchase a seat.", costToUser: "$240 per user through the institutional plan.",
    evidenceQuotes: ["UM System has purchased an Education version of ChatGPT that includes additional data protections and has been approved for up to DCL3.", "Please submit a ticket to IT to purchase a seat."]
  },
  {
    qsRow: 533, urlIncludes: "/ai/faculty", tool: "chatgpt", rawToolName: "ChatGPT through USC License",
    description: "The University of South Carolina provides faculty a university-licensed ChatGPT account with a protected USC environment.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "USC institutional ChatGPT licence.", accessAudience: "USC faculty.", accessStatus: "Current Garnet AI Foundry faculty service.", howToObtain: "Use the Claim Your Account and Log In links on the official USC faculty AI page.", costToUser: "Institutional licence; no individual price is stated.",
    evidenceQuotes: ["Benefits of Using ChatGPT through USC's License", "All conversations and files remain private within USC’s secure environment."]
  },
  {
    qsRow: 533, urlIncludes: "/ai/faculty", tool: "microsoft_copilot", rawToolName: "Microsoft Copilot",
    description: "USC offers Microsoft Copilot licences to faculty and staff through its official software purchase path.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "University-managed Microsoft Copilot licensing path.", accessAudience: "USC faculty and staff.", accessStatus: "Current Garnet AI Foundry faculty service.", howToObtain: "Use the Get a License link on the official USC faculty AI page.", costToUser: "$250 per year.",
    evidenceQuotes: ["Microsoft Copilot, now available for $250/year for faculty and staff, brings artificial intelligence to Microsoft tools, helping save time and streamline workflows."]
  },
  {
    qsRow: 544, urlIncludes: "/integrity/artificial-intelligence", tool: "microsoft_copilot", rawToolName: "Bing Chat Enterprise",
    description: "Bing Chat Enterprise is included in the University of Manitoba M365 A3 licence and available to all students, staff, and faculty, although the university cautions that it has not formally approved specific GenAI software.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "Included in the University of Manitoba M365 A3 licence.", accessAudience: "All University of Manitoba students, staff, and faculty.", accessStatus: "Available under the licence; university cautions that specific GenAI software has not been formally approved.", howToObtain: "Access through the university Microsoft 365 environment.", costToUser: "Included in the institutional M365 A3 licence.",
    evidenceQuotes: ["Microsoft has included Bing Chat in the Office365 suite, and it is now part of the University of Manitoba’s M365 A3 license, which is available to all students, staff, and faculty.", "The University of Manitoba, however, has not formally approved the use of specific genAI software, genAI tools within our M365 A3 license should be considered with the same caution that would be applied to other third-party applications that ingest personal data."]
  },
  {
    qsRow: 540, urlIncludes: "ai-riktlinjer-for-vasa-ovningsskola", tool: "microsoft_copilot", rawToolName: "Microsoft 365 Copilot Chat",
    description: "Åbo Akademi University recommends Microsoft 365 Copilot Chat for Vasa övningsskola teachers and staff and enables protected access with an abo.fi account.", endorsementType: "officially_endorsed", institutionalRelationship: "Åbo Akademi-recommended Microsoft 365 service with institutional-account protection.", accessAudience: "Vasa övningsskola teachers, staff, pupils, and students within Åbo Akademi.", accessStatus: "Current approved-tool guidance.", howToObtain: "Use Copilot Chat while logged in with an abo.fi account.", costToUser: "Available to eligible school users; no individual price is stated.",
    evidenceQuotes: ["Teachers and staff at Vasa övningsskola can use the AI tools recommended by Åbo Akademi University in their work", "Microsoft 365 Copilot Chat is an AI assistant", "Data protection for companies", "abo.fi user account"]
  },
  {
    qsRow: 540, urlIncludes: "ai-riktlinjer-for-vasa-ovningsskola", tool: "buzz_transcribe", rawToolName: "Buzz Transcribe",
    description: "Åbo Akademi University recommends Buzz Transcribe as a data-secure transcription tool for Vasa övningsskola teachers and staff.", endorsementType: "officially_endorsed", institutionalRelationship: "Included in Åbo Akademi's recommended AI tools for the university practice school.", accessAudience: "Vasa övningsskola teachers and staff.", accessStatus: "Current approved-tool guidance.", howToObtain: "Follow Åbo Akademi ICT's approved-tool guidance.", costToUser: "Not stated.",
    evidenceQuotes: ["Teachers and staff at Vasa övningsskola can use the AI tools recommended by Åbo Akademi University in their work", "Buzz Transcribe is an AI-based program for transcribing audio files, such as interviews, in a data-secure way"]
  },
  {
    qsRow: 540, urlIncludes: "ai-riktlinjer-for-vasa-ovningsskola", tool: "larabot", rawToolName: "Larabot",
    description: "Vasa övningsskola lists Larabot as an approved AI tool for pupils and students in grades 1–6.", endorsementType: "officially_endorsed", institutionalRelationship: "Approved by the Åbo Akademi practice school for pupil and student use.", accessAudience: "Vasa övningsskola pupils and students in grades 1–6.", accessStatus: "Current approved-tool guidance.", howToObtain: "Use Larabot through the official service link in the school guidance.", costToUser: "The guidance requires approved teaching tools to be available free of charge.",
    evidenceQuotes: ["Approved AI tools for pupils and students at Vasa övningsskola", "Larabot", "can be used in grades 1–6"]
  },
  {
    qsRow: 540, urlIncludes: "ai-riktlinjer-for-vasa-ovningsskola", tool: "duck_ai", rawToolName: "Duck AI",
    description: "Vasa övningsskola lists Duck AI as an approved privacy-oriented AI tool for users aged 13 and older.", endorsementType: "officially_endorsed", institutionalRelationship: "Approved by the Åbo Akademi practice school for pupil and student use.", accessAudience: "Vasa övningsskola pupils and students aged 13 and older.", accessStatus: "Current approved-tool guidance.", howToObtain: "Use Duck AI through the official service link in the school guidance.", costToUser: "Free.",
    evidenceQuotes: ["Approved AI tools for pupils and students at Vasa övningsskola", "Duck AI", "can be used from the age of 13", "Duck AI is a generative AI service that is free and safe to use."]
  },
  {
    qsRow: 546, urlIncludes: "/employee/communication-tips/chatuit", tool: "institutional_ai_service", rawToolName: "ChatUiT",
    description: "UiT operates ChatUiT, its privacy-protected version of ChatGPT, for all staff and students.", endorsementType: "self_hosted_system", institutionalRelationship: "UiT-operated ChatGPT service.", accessAudience: "All UiT staff and students.", accessStatus: "Current official employee guidance; changed June 2026.", howToObtain: "Open ChatUiT through the university service link.", costToUser: "University-provided service.",
    evidenceQuotes: ["ChatUiT is UiT's own version of ChatGPT.", "It is available for all staff and students at UiT, and user data is neither shared or used for training."]
  },
  {
    qsRow: 546, urlIncludes: "/employee/communication-tips/chatuit", tool: "microsoft_copilot", rawToolName: "Copilot Chat",
    description: "UiT provides privacy-protected Copilot Chat through UiT account login.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "UiT-account Microsoft Copilot service.", accessAudience: "UiT account holders.", accessStatus: "Current official employee guidance; changed June 2026.", howToObtain: "Log in with a UiT account at office.com, Edge, or the Windows 11 application.", costToUser: "Included for eligible UiT account holders.",
    evidenceQuotes: ["Copilot Chat is a tool that assists you with text-related tasks such as brainstorming, structuring and document analysis. Log in with your UiT account at office.com.", "Copilot Chat is also available in the web browser Edge and as a standalone program in Windows 11."]
  },
  {
    qsRow: 555, urlIncludes: "genai.usf.edu/genai-resources/tools", tool: "microsoft_copilot", rawToolName: "Microsoft Copilot Chat",
    description: "USF provides privacy-protected Microsoft Copilot Chat to all students and employees.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "USF enterprise Microsoft service.", accessAudience: "All USF students and employees.", accessStatus: "Current official USF IT guidance.", howToObtain: "Use the USF IT Microsoft Copilot Chat access instructions.", costToUser: "Included for eligible USF users.",
    evidenceQuotes: ["Microsoft Copilot Chat is available to all USF students and employees.", "Unlike ChatGPT, the tool can be used in a secure, encrypted environment to maintain data privacy."]
  },
  {
    qsRow: 555, urlIncludes: "genai.usf.edu/genai-resources/tools", tool: "microsoft_copilot", rawToolName: "Copilot for Microsoft 365",
    description: "USF offers departmental purchase of Copilot for Microsoft 365 licences for employees.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "USF-managed departmental licensing path.", accessAudience: "USF employees whose departments purchase a licence.", accessStatus: "Current official USF IT guidance.", howToObtain: "Purchase a licence through USF Software via the employee's department.", costToUser: "Departmental purchase required.",
    evidenceQuotes: ["Copilot for M365 licenses are available for departmental purchase for USF employees."]
  },
  {
    qsRow: 555, urlIncludes: "guides.lib.usf.edu/AI/LINK", tool: "institutional_ai_service", rawToolName: "LINK",
    description: "USF Libraries built and maintains LINK, a production AI chatbot grounded in library resources.", endorsementType: "self_hosted_system", institutionalRelationship: "Built and maintained by USF Libraries.", accessAudience: "USF Libraries users.", accessStatus: "Production service documented by USF Libraries.", howToObtain: "Use LINK through the USF Libraries AI guide.", costToUser: "Library-provided service.",
    evidenceQuotes: ["LINK (Library Information and Knowledge chatbot) is a production AI reference tool built and maintained by USF Libraries staff."]
  },
  {
    qsRow: 560, urlIncludes: "/cio/it-services/communication-and-collaboration/microsoft-365/", tool: "microsoft_copilot", rawToolName: "Copilot Basic",
    description: "Memorial University includes Copilot Basic in its Microsoft 365 environment for eligible faculty and staff.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "Memorial Microsoft 365 licensing agreement.", accessAudience: "Eligible current Memorial faculty and staff.", accessStatus: "Current CIO service catalogue.", howToObtain: "Sign in to Memorial Microsoft 365 and open Copilot Basic.", costToUser: "Included in the institutional Microsoft 365 environment.",
    evidenceQuotes: ["Copilot Basic is a generative AI tool available in Memorial’s Microsoft 365 environment.", "Current faculty", "Current staff"]
  },
  {
    qsRow: 560, urlIncludes: "/cio/it-services/communication-and-collaboration/microsoft-365/", tool: "microsoft_copilot", rawToolName: "Copilot Premium",
    description: "Memorial units can purchase Copilot Premium add-on licences for their users through IT Procurement.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "University-managed Microsoft 365 add-on procurement.", accessAudience: "Memorial users whose units purchase the add-on.", accessStatus: "Current CIO service catalogue.", howToObtain: "The user's unit purchases the licence through IT Procurement.", costToUser: "Paid add-on purchased by the unit.",
    evidenceQuotes: ["There are Microsoft 365 services that are not available by default at Memorial and require a paid add-on license that units must purchase for their users (e.g.Copilot Premium).", "These licenses must be purchased by units (rather than individual users) through IT Procurement."]
  },
  {
    qsRow: 568, urlIncludes: "/news/free-access-enhanced-ai-tools", tool: "institutional_ai_service", rawToolName: "Lehigh LibreChat LLM Gateway",
    description: "Lehigh provides a LibreChat multi-model LLM Gateway free to all faculty and graduate students without a separate access request.", endorsementType: "self_hosted_system", institutionalRelationship: "Lehigh-operated multi-model gateway.", accessAudience: "All Lehigh faculty and graduate students.", accessStatus: "Available since December 2025.", howToObtain: "Open the Lehigh LibreChat LLM Gateway; no sign-up is required.", costToUser: "Free to eligible Lehigh users.",
    evidenceQuotes: ["all Lehigh faculty and graduate students now have free access to", "which provides access to a variety of Generative AI tools (including OpenAI, Perplexity, Claude, and Gemini) within a single interface.", "This tool is available to you now, there is no need to sign up for access."]
  },
  ...[
    ["chatgpt", "OpenAI via Lehigh LLM Gateway"],
    ["perplexity", "Perplexity via Lehigh LLM Gateway"],
    ["claude", "Claude via Lehigh LLM Gateway"],
    ["gemini", "Gemini via Lehigh LLM Gateway"]
  ].map(([tool, rawToolName]) => ({
    qsRow: 568, urlIncludes: "/news/free-access-enhanced-ai-tools", tool, rawToolName,
    description: `${rawToolName} is available through Lehigh's free LibreChat LLM Gateway for faculty and graduate students.`, endorsementType: "self_hosted_system", institutionalRelationship: "Delivered through the Lehigh LibreChat LLM Gateway.", accessAudience: "All Lehigh faculty and graduate students.", accessStatus: "Available since December 2025.", howToObtain: "Open the Lehigh LLM Gateway; no separate sign-up is required.", costToUser: "Free to eligible Lehigh users.", evidenceQuotes: ["all Lehigh faculty and graduate students now have free access to", "which provides access to a variety of Generative AI tools (including OpenAI, Perplexity, Claude, and Gemini) within a single interface."]
  })),
  {
    qsRow: 568, urlIncludes: "/news/free-access-enhanced-ai-tools", tool: "gemini", rawToolName: "Google Gemini",
    description: "Lehigh lists Gemini among Google AI tools available to all campus users.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "Lehigh campus Google AI suite.", accessAudience: "All Lehigh campus users.", accessStatus: "Current official ITS announcement.", howToObtain: "Access through the Lehigh Google environment.", costToUser: "Included for campus users.",
    evidenceQuotes: ["The LLM Gateway is an addition to the suite of Google AI tools available to all campus users", "Gemini"]
  },
  {
    qsRow: 568, urlIncludes: "/news/free-access-enhanced-ai-tools", tool: "notebooklm", rawToolName: "NotebookLM",
    description: "Lehigh lists NotebookLM among Google AI tools available to all campus users.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "Lehigh campus Google AI suite.", accessAudience: "All Lehigh campus users.", accessStatus: "Current official ITS announcement.", howToObtain: "Access through the Lehigh Google environment.", costToUser: "Included for campus users.",
    evidenceQuotes: ["The LLM Gateway is an addition to the suite of Google AI tools available to all campus users", "NotebookLM"]
  },
  {
    qsRow: 568, urlIncludes: "/news/free-access-enhanced-ai-tools", tool: "google_ai_studio", rawToolName: "Google AI Studio",
    description: "Lehigh lists Google AI Studio among Google AI tools available to all campus users.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "Lehigh campus Google AI suite.", accessAudience: "All Lehigh campus users.", accessStatus: "Current official ITS announcement.", howToObtain: "Access through the Lehigh Google environment.", costToUser: "Included for campus users.",
    evidenceQuotes: ["The LLM Gateway is an addition to the suite of Google AI tools available to all campus users", "AI Studio"]
  },
  ...[
    ["gemini", "Google AI Pro"],
    ["microsoft_copilot", "Copilot Pro"],
    ["claude", "Claude Pro"],
    ["chatgpt", "OpenAI ChatGPT"]
  ].map(([tool, rawToolName]) => ({
    qsRow: 568, urlIncludes: "/news/free-access-enhanced-ai-tools", tool, rawToolName,
    description: `${rawToolName} can be requested free by Lehigh faculty and graduate students.`, endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "Lehigh-managed advanced AI access request.", accessAudience: "Lehigh faculty and graduate students.", accessStatus: "Available since December 2025.", howToObtain: "Request access through Lehigh's enhanced AI tools process.", costToUser: "Free to eligible Lehigh users.", evidenceQuotes: ["faculty and graduate students may now request free access to one of the following advanced AI tools:", rawToolName]
  })),
  {
    qsRow: 569, urlIncludes: "ezdroje.upol.cz/aktuality", tool: "proquest_research_assistant", rawToolName: "ProQuest Research Assistant",
    description: "Palacký University provides ProQuest Research Assistant as part of its ProQuest Central subscription.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "Included in the university ProQuest Central subscription.", accessAudience: "Eligible Palacký University e-resource users.", accessStatus: "Current university e-resources announcement.", howToObtain: "Open ProQuest Central through the university e-resources portal.", costToUser: "Included with the institutional subscription.",
    evidenceQuotes: ["As part of the subscription to the ProQuest Central database, you can use the new AI tool ProQuest Research Assistant."]
  },
  {
    qsRow: 572, urlIncludes: "/en/newsdetail/tu-dortmund-university-offers-chatgpt-access", tool: "institutional_ai_service", rawToolName: "Campus-AI",
    description: "TU Dortmund provides Campus-AI to all university members with anonymous, free ChatGPT access through SSO.", endorsementType: "self_hosted_system", institutionalRelationship: "TU Dortmund Campus-AI interface.", accessAudience: "All TU Dortmund students and employees.", accessStatus: "Available since January 2025.", howToObtain: "Log in through the ServicePortal or Campus-AI direct link using university SSO.", costToUser: "Free to all university members.",
    evidenceQuotes: ["students and employees can now use the Campus AI (“Campus-KI” in German) interface to access ChatGPT-4o anonymously and free of charge.", "users must log in with their university account via Single Sign-On (SSO)."]
  },
  {
    qsRow: 572, urlIncludes: "/en/newsdetail/tu-dortmund-university-offers-chatgpt-access", tool: "chatgpt", rawToolName: "ChatGPT-4o via Campus-AI",
    description: "TU Dortmund offers mini and full ChatGPT-4o models to all university members through Campus-AI.", endorsementType: "self_hosted_system", institutionalRelationship: "Delivered through TU Dortmund Campus-AI.", accessAudience: "All TU Dortmund students and employees.", accessStatus: "Available since January 2025.", howToObtain: "Use Campus-AI with university SSO.", costToUser: "Free to all university members.",
    evidenceQuotes: ["The Campus-AI interface offers users access to two versions of ChatGPT-4o (the “o” stands for “omni”): The mini version and the full version, which is otherwise much more limited or subject to a fee."]
  },
  {
    qsRow: 572, urlIncludes: "/en/newsdetail/tu-dortmund-university-offers-chatgpt-access", tool: "institutional_ai_service", rawToolName: "Academic Cloud ChatAI",
    description: "All TU Dortmund members can access Academic Cloud ChatAI with around ten non-commercial LLMs through federated SSO.", endorsementType: "institutional_ai_service", institutionalRelationship: "State-coordinated Academic Cloud available through TU Dortmund federation.", accessAudience: "All TU Dortmund members.", accessStatus: "Current official university access route.", howToObtain: "Select TU Dortmund in Academic Cloud and log in through federated SSO.", costToUser: "Available to all university members.",
    evidenceQuotes: ["all members of TU Dortmund University have access to other AI applications via the “Academic Cloud” platform", "ChatAI is a service with around ten different non-commercial Large Language Models (LLMs)"]
  },
  {
    qsRow: 586, urlIncludes: "/google/news/2026/04/gemini-and-notebook-lm", tool: "notebooklm", rawToolName: "Google NotebookLM Education",
    description: "TMU provides the education version of NotebookLM to all TMU Google account holders under its core Google agreement.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "Part of TMU Google Workspace under the university's core agreement.", accessAudience: "All TMU Google account holders.", accessStatus: "Available since April 2026.", howToObtain: "Use NotebookLM with a TMU Google account.", costToUser: "Included for TMU Google account holders.",
    evidenceQuotes: ["All TMU Google account holders can now use their university Google Workspace account to access the education version of Google NotebookLM", "As NotebookLM is part of our Google Workspace service, your data is protected under the university’s core agreement with Google when you log in with your TMU credentials."]
  },
  {
    qsRow: 586, urlIncludes: "/courses/whats-new/2025/04/google-gemini", tool: "gemini", rawToolName: "Google Gemini Education",
    description: "TMU provides the education version of Google Gemini to all faculty and staff through the TMU Google Workspace account.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "Part of TMU Google Workspace under the university's core agreement.", accessAudience: "All TMU faculty and staff.", accessStatus: "Available since April 2025.", howToObtain: "Log into Gemini using a TMU Google Workspace account.", costToUser: "Included for eligible TMU users.",
    evidenceQuotes: ["Starting April 29, 2025, all faculty and staff can use their TMU Google Workspace account to access the education version of the Google Gemini app", "your data is protected under TMU’s core agreement with Google when you log in to Gemini with your TMU credentials."]
  },
  {
    qsRow: 586, urlIncludes: "/courses/whats-new/2025/04/google-gemini", tool: "zoom_ai_companion", rawToolName: "Zoom AI Companion",
    description: "TMU enables Zoom AI Companion for all faculty and staff.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "Enabled within TMU Zoom accounts.", accessAudience: "All TMU faculty and staff.", accessStatus: "Available since April 2025.", howToObtain: "Enable AI Companion in individual TMU Zoom account settings.", costToUser: "Included for eligible TMU Zoom users.",
    evidenceQuotes: ["Alongside Gemini, Zoom’s AI Companion is now available to all faculty and staff.", "You may choose to enable the AI Companion under your individual Zoom account settings."]
  },
  {
    qsRow: 588, urlIncludes: "researchdata.unl.edu/planning/artificial-intelligence", tool: "microsoft_copilot", rawToolName: "Copilot Chat",
    description: "The University of Nebraska Microsoft tenant provides privacy-protected Copilot Chat free to all NU users.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "Included in the NU Microsoft tenant and governed by NU contracts.", accessAudience: "All NU users, including UNL users.", accessStatus: "Current official UNL research-data guidance.", howToObtain: "Access within the NU Microsoft tenant using NU credentials.", costToUser: "Free to all NU users.",
    evidenceQuotes: ["The new Microsoft tenant includes the free version of Copilot, Copilot Chat, for all NU users.", "This version does not use entered information for model training purposes and data entered remains private to NU."]
  },
  {
    qsRow: 588, urlIncludes: "researchdata.unl.edu/planning/artificial-intelligence", tool: "microsoft_copilot", rawToolName: "Microsoft 365 Copilot",
    description: "UNL users can purchase Microsoft 365 Copilot through the NU Microsoft environment with institutional security controls.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "Paid add-on in the NU Microsoft tenant.", accessAudience: "UNL users purchasing the add-on.", accessStatus: "Current official UNL research-data guidance.", howToObtain: "Purchase within the NU-supported Microsoft environment.", costToUser: "$30 per month as of August 2025.",
    evidenceQuotes: ["Users can also purchase Microsoft 365 Copilot for a monthly fee of $30", "Microsoft 365 Copilot is $30/mo (as of August 2025)"]
  },
  {
    qsRow: 588, urlIncludes: "researchdata.unl.edu/planning/artificial-intelligence", tool: "zoom_ai_companion", rawToolName: "Zoom AI Companion",
    description: "The University of Nebraska enables Zoom AI Companion within NU Zoom tenants.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "Enabled in NU Zoom tenants.", accessAudience: "Eligible NU Zoom users, including UNL users.", accessStatus: "Current official UNL research-data guidance.", howToObtain: "Use within the NU Zoom tenant.", costToUser: "Included for eligible NU Zoom users.",
    evidenceQuotes: ["Zoom AI Companion is enabled within NU Zoom tenants."]
  },
  {
    qsRow: 588, urlIncludes: "researchdata.unl.edu/planning/artificial-intelligence", tool: "chatgpt", rawToolName: "ChatGPT Enterprise via OpenAI Impact Program",
    description: "UNL uses ChatGPT Enterprise through its OpenAI Impact program under NU contract and SSO controls.", endorsementType: "officially_endorsed", institutionalRelationship: "OpenAI Impact program within NU computing systems.", accessAudience: "Participants in the UNL OpenAI Impact program.", accessStatus: "Current official UNL research-data guidance.", howToObtain: "Participate through the UNL OpenAI Impact program and NU SSO.", costToUser: "Program-provided access.",
    evidenceQuotes: ["ChatGPT Enterprise is being utilized through the OpenAI Impact program.", "When accessed within the NU computing systems (such as with SSO login), your data is not used for training, and ensures use is governed by NU contracts and compliance with NU security and privacy controls."]
  },
  {
    qsRow: 588, urlIncludes: "researchdata.unl.edu/planning/artificial-intelligence", tool: "institutional_ai_service", rawToolName: "NU Custom AI Services",
    description: "NU provides custom AI services through Microsoft Azure and AWS, with additional on-premises services through the Holland Computing Center.", endorsementType: "institutional_ai_service", institutionalRelationship: "NU ITS and Holland Computing Center-supported AI infrastructure.", accessAudience: "Eligible NU and UNL users.", accessStatus: "Current official UNL research-data guidance.", howToObtain: "Contact NU ITS or the Holland Computing Center.", costToUser: "Cloud usage is pass-through cost; some on-premises options have no cost.",
    evidenceQuotes: ["Custom AI services within Microsoft Azure and Amazon Web Services (AWS) are also available.", "Additional on-premises AI services are available through the Holland Computing Center (HCC), including no cost options."]
  },
  {
    qsRow: 594, urlIncludes: "/ai-tools/ms-365-copilot-chat", tool: "microsoft_copilot", rawToolName: "Microsoft 365 Copilot Chat",
    description: "The University of Cincinnati Microsoft 365 licensing agreement gives current students, faculty, and staff privacy-protected Copilot Chat access.", endorsementType: "institutionally_licensed_or_procured", institutionalRelationship: "University Microsoft 365 licensing agreement.", accessAudience: "Current UC students, faculty, and staff.", accessStatus: "Current official AI at UC guidance.", howToObtain: "Sign into Copilot Chat with an official UC email.", costToUser: "Included in the institutional Microsoft 365 agreement.",
    evidenceQuotes: ["The university’s Microsoft 365 licensing agreement provides current students, faculty, and staff privacy protected access to Microsoft Copilot chat."]
  }
];

async function main() {
  const [document, repair, ledger] = await Promise.all([readJson(RECORDS_PATH), readJson(REPAIR_PATH), readJson(LEDGER_PATH)]);
  const rows = new Map(repair.rows.map((row: Json) => [row.qsRow, row]));
  const ledgerRows = new Map(ledger.entries.map((row: Json) => [row.qsRow, row]));
  const ranking = await readJson("data/rankings/qs-world-university-rankings-2026-top-1000.json");
  const rankingRows = new Map(ranking.universities.map((row: Json) => [row.rowNumber, row]));
  const canonicalSlugOverrides = new Map<number, string>([
    [510, "the-university-of-tennessee-knoxville"],
    [539, "universite-de-fribourg"]
  ]);
  const toolSlugOverrides = new Map<string, string>([
    ["Buzz Transcribe", "buzz_transcribe"],
    ["Larabot", "larabot"],
    ["Duck AI", "duck_ai"]
  ]);
  const records = document.records.map((record: Json) => {
    const universitySlug = canonicalSlugOverrides.get(record.qsRow);
    const rankingRow = rankingRows.get(record.qsRow);
    const tool = toolSlugOverrides.get(record.rawToolName) ?? record.tool;
    return { ...record, tool, ...(universitySlug ? { universitySlug, universityName: rankingRow?.name ?? record.universityName } : {}) };
  });
  const keys = new Set(records.map(recordId));

  for (const spec of specs) {
    const rankingRow = rankingRows.get(spec.qsRow);
    if (!rankingRow) throw new Error(`Missing ranking row ${spec.qsRow}`);
    const repairRow = rows.get(spec.qsRow);
    const ledgerRow = ledgerRows.get(spec.qsRow);
    const checks = [...(repairRow?.checks ?? []), ...(ledgerRow?.directOfficialPageChecks ?? [])];
    const check = checks.find((value: Json) => String(value.finalUrl ?? value.requestedUrl).includes(spec.urlIncludes) && value.snapshotPath && value.snapshotHash);
    if (!check) throw new Error(`No successful snapshot for QS ${spec.qsRow} ${spec.urlIncludes}`);
    const snapshot = await readFile(check.snapshotPath, "utf8");
    for (const quote of spec.evidenceQuotes) if (!visible(snapshot).includes(normalize(quote))) throw new Error(`Quote not found for QS ${spec.qsRow} ${spec.rawToolName}: ${quote}`);
    const record: Json = {
      universitySlug: canonicalSlugOverrides.get(spec.qsRow) ?? slug(rankingRow.name), universityName: rankingRow.name, qsRow: spec.qsRow, qsRank: rankingRow.rankNumber,
      tool: spec.tool, rawToolName: spec.rawToolName, description: spec.description, availability: "allowed", endorsementType: spec.endorsementType,
      institutionalRelationship: spec.institutionalRelationship, accessAudience: spec.accessAudience, accessStatus: spec.accessStatus,
      howToObtain: spec.howToObtain, costToUser: spec.costToUser, reviewState: "agent_reviewed", reviewOrigin: "qs-501-600-20260718-009-full-repair-review", evidenceAsOf: "2026-07-18",
      evidence: spec.evidenceQuotes.map((quote) => ({ sourceUrl: check.finalUrl ?? check.requestedUrl, sourceTitle: check.sourceTitle ?? "Official university AI tools page", sourceLanguage: validLanguage(check.sourceLanguage), evidenceSnippet: quote, evidenceSnippetOriginal: quote, snapshotHash: check.snapshotHash, snapshotPath: check.snapshotPath, sourceFetchedAt: check.fetchedAt, reviewState: "agent_reviewed" }))
    };
    if (!keys.has(recordId(record))) { records.push(record); keys.add(recordId(record)); }
  }
  records.sort((a, b) => a.qsRow - b.qsRow || a.universitySlug.localeCompare(b.universitySlug) || a.rawToolName.localeCompare(b.rawToolName));
  await writeFile(RECORDS_PATH, `${JSON.stringify({ ...document, generatedAt: new Date().toISOString(), records }, null, 2)}\n`);
  console.log(JSON.stringify({ records: records.length, universities: new Set(records.map((record) => record.universitySlug)).size, addedSpecs: specs.length }, null, 2));
}

function recordId(record: Json) { return `${record.universitySlug}:${record.tool}:${record.rawToolName}`; }
function normalize(value: string) { return value.normalize("NFKC").replace(/[\u00a0\s]+/g, " ").trim(); }
function visible(value: string) { return normalize(value.replace(/[*_#`|]/g, " ").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")); }
function slug(value: string) { return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").replace(/^the-/, "").replace(/-formerly.*$/, ""); }
function validLanguage(value: unknown) { const language = String(value ?? "und").toLowerCase().split("-")[0]; return /^[a-z]{2,3}$/.test(language) ? language : "und"; }
async function readJson(file: string): Promise<Json> { return JSON.parse(await readFile(file, "utf8")); }
void main().catch((error) => { console.error(error); process.exitCode = 1; });
