import { hasCurrentIndexRecoveryBasis, reviewedClaimsFingerprint } from "@/lib/index-recovery-basis";
import { isIndexRecoveryPilotSlug, type IndexRecoveryPilotSlug } from "@/lib/index-recovery-pilot";
import type { PolicyClaim } from "@uapt/shared";

export type ScenarioStatus = "Can, with limits" | "Do not";
export type PolicyEvidenceHref = `#snapshot-${string}` | `#claim-${string}` | "#claims" | `https://${string}`;

export interface PolicySceneScenarioCheck {
  status: ScenarioStatus;
  scope: string;
  label: string;
  detail?: string;
}

export interface PolicySceneStoryCard {
  audience?: "student" | "research";
  placement?: "coursework" | "exams" | "disclosure" | "privacy_data" | "approved_tools" | "research_publication";
  title: string;
  summary: string;
  artworkAlt: string;
  artworkSrc: string;
  artworkLandscape?: boolean;
  evidenceHref: PolicyEvidenceHref;
}

export interface PolicySceneQuickCheck {
  text: string;
  evidenceHref: PolicyEvidenceHref;
}

export interface PolicySceneQuickGuidePanel {
  artworkAlt: string;
  artworkSrc: string;
  artworkLandscape?: boolean;
  checks: [PolicySceneQuickCheck, PolicySceneQuickCheck, PolicySceneQuickCheck];
}

export interface PolicySceneQuickGuide {
  scopeNote: string;
  do: PolicySceneQuickGuidePanel;
  dont: PolicySceneQuickGuidePanel;
}

export type IllustratedPilotSlug =
  | IndexRecoveryPilotSlug
  | "stanford-university"
  | "university-of-cambridge"
  | "massachusetts-institute-of-technology"
  | "university-of-exeter"
  | "keele-university"
  | "university-of-glasgow"
  | "tilburg-university"
  | "university-of-aberdeen"
  | "flinders-university"
  | "kingston-university-london"
  | "university-of-victoria-uvic"
  | "chalmers-university-of-technology"
  | "cardiff-university";

export interface PolicyScenePilot {
  slug: IllustratedPilotSlug;
  eyebrow: string;
  title: string;
  guidance: string;
  evidenceLabel: string;
  evidenceHref: "#student-policy-heading" | "#quick-guide" | "#claims" | `https://${string}`;
  artworkAlt: string;
  artworkSrc: string;
  artworkMobileSrc?: string;
  artworkContainsText?: boolean;
  artworkSquare?: boolean;
  artworkLandscape?: boolean;
  claimsOnly?: boolean;
  snapshotNotice?: string;
  scenarioChecks?: [PolicySceneScenarioCheck, PolicySceneScenarioCheck];
  storyCards?: PolicySceneStoryCard[];
  quickGuide?: PolicySceneQuickGuide;
  storyLayout?: string;
  showGallerySummaries?: boolean;
  studentFirst?: boolean;
  scopeDetail?: string;
  sourceUpdate?: { text: string; href: `https://${string}` };
}

const noSnapshotNotice = "No reviewed student policy snapshot has been published yet.";

const scenes: Record<IllustratedPilotSlug, PolicyScenePilot> = {
  "stanford-university": {
    slug: "stanford-university",
    studentFirst: true,
    eyebrow: "Student guide · School and course rules",
    title: "Find the rule for your course.",
    guidance: "Start with your syllabus and assignment instructions. PWR and MD/MSPA have different rules; these examples are not a campus-wide permission list.",
    evidenceLabel: "See what to do",
    evidenceHref: "#quick-guide",
    artworkAlt: "A blue-hoodie student asks an instructor about the course brief while comparing school handbooks.",
    artworkSrc: "/assets/policy-scenes/stanford-hero-v2.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    showGallerySummaries: true,
    quickGuide: {
      scopeNote: "Student guidance for the cited courses and programs. Tool access does not give assessment permission.",
      do: {
        artworkSrc: "/assets/policy-scenes/stanford-do-v2.jpg", artworkLandscape: true,
        artworkAlt: "Student checks the assignment instructions together with an instructor.",
        checks: [
          { text: "Check your school policy and this task's instructions.", evidenceHref: "#snapshot-coursework" },
          { text: "Ask your instructor when the course rule is unclear.", evidenceHref: "https://pwr.stanford.edu/about-pwr/pwr-policies/pwr-policy-use-genai-and-llms" },
          { text: "MD/MSPA: disclose and cite substantial AI contributions.", evidenceHref: "#snapshot-disclosure" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/stanford-dont-v2.jpg", artworkLandscape: true,
        artworkAlt: "PWR-only scene: student closes an AI draft and writes their own major assignment.",
        checks: [
          { text: "PWR: don't use AI to draft or revise major assignments.", evidenceHref: "#snapshot-coursework" },
          { text: "MD/MSPA: don't use AI in restricted exams without authorization.", evidenceHref: "#snapshot-exams" },
          { text: "Medicine: don't paste patient data into public AI tools.", evidenceHref: "#snapshot-privacy_data" }
        ]
      }
    },
    storyCards: [
      {
        placement: "disclosure", title: "MD/MSPA: document substantial AI use",
        summary: "For these medical programs, disclose and cite substantial AI contributions: record the tool, model/version, date, query and output excerpt. Your assignment must permit the use first.",
        artworkAlt: "MD/MSPA student records permitted AI contributions alongside an assignment.",
        artworkSrc: "/assets/policy-scenes/stanford-disclosure-v2.jpg", artworkLandscape: true,
        evidenceHref: "#snapshot-disclosure"
      },
      {
        placement: "privacy_data", title: "Medicine: keep patient data out of public AI",
        summary: "Do not enter confidential research, patient data or PHI into public AI platforms. Follow the approved Medicine platform and task conditions for sensitive work.",
        artworkAlt: "Medicine student secures a patient folder away from a public AI chat.",
        artworkSrc: "/assets/policy-scenes/stanford-privacy-v2.jpg", artworkLandscape: true,
        evidenceHref: "#snapshot-privacy_data"
      }
    ]
  },
  "harvard-university": {
    slug: "harvard-university",
    eyebrow: "Start with your course",
    title: "Follow your school and course AI rule.",
    guidance: "",
    evidenceLabel: "Read the reviewed policy snapshot",
    evidenceHref: "#student-policy-heading",
    artworkAlt: "Comic: a student follows School and Course signs and asks an instructor for the applicable assignment rule.",
    artworkSrc: "/assets/policy-scenes/harvard-mechanism-hero-v2.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    quickGuide: {
      scopeNote: "Harvard guidance points you to your school and course. The HGSE example here applies only at HGSE.",
      do: {
        artworkSrc: "/assets/policy-scenes/harvard-mechanism-do.jpg",
        artworkLandscape: true,
        artworkAlt: "Comic titled Follow your course path: a student finds the right school and asks an instructor about the assignment rule.",
        checks: [
          { text: "Check your school's policy and this assignment's rule.", evidenceHref: "#snapshot-coursework" },
          { text: "Ask your instructor if the permitted use is unclear.", evidenceHref: "https://provost.harvard.edu/guidelines-using-chatgpt-and-other-generative-ai-tools-harvard" },
          { text: "Check data restrictions before using a public AI tool.", evidenceHref: "#snapshot-privacy_data" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/harvard-mechanism-dont.jpg",
        artworkLandscape: true,
        artworkAlt: "HGSE-scoped comic: the student does the thinking and writing rather than submitting AI-generated coursework as their own.",
        checks: [
          { text: "HGSE: don't submit AI-generated assignment work as your own.", evidenceHref: "https://registrar.gse.harvard.edu/learning/policies-forms/ai-policy" },
          { text: "HGSE: don't omit documentation of permitted AI use.", evidenceHref: "#snapshot-disclosure" },
          { text: "Don't apply an HGSE rule to another Harvard school.", evidenceHref: "#snapshot-coursework" }
        ]
      }
    },
    storyCards: [
      {
        placement: "coursework",
        title: "HGSE: use AI as a thought partner",
        summary: "HGSE permits idea exploration and clarification, while students remain responsible for their own thinking and writing. Your instructor may set a different course rule.",
        artworkAlt: "HGSE-specific scene: a student consults AI for ideas and develops their own argument.",
        artworkSrc: "/assets/policy-scenes/harvard-mechanism-thought.jpg",
        artworkLandscape: true,
        evidenceHref: "https://registrar.gse.harvard.edu/learning/policies-forms/ai-policy"
      },
      {
        title: "HGSE only: record permitted use",
        summary: "HGSE requires students to acknowledge and document permitted AI use in assignments. Check your own course rule first.",
        artworkAlt: "Comic scene: a student records AI use beside an HGSE assignment; text says HGSE only and Record permitted AI use.",
        artworkSrc: "/assets/policy-scenes/harvard-hgse.jpg",
        evidenceHref: "#snapshot-disclosure"
      }
    ]
  },
  "unsw-sydney": {
    slug: "unsw-sydney",
    eyebrow: "Start with the assessment",
    title: "Find the assessment category before using AI.",
    guidance: "",
    evidenceLabel: "Read the reviewed policy snapshot",
    evidenceHref: "#student-policy-heading",
    artworkAlt: "Two-panel comic: a student checks an assessment's AI category and stops before using AI in a no-assistance task.",
    artworkSrc: "/assets/policy-scenes/unsw-comic.jpg",
    artworkContainsText: true,
    artworkSquare: true,
    quickGuide: {
      scopeNote: "Your assessment category decides whether AI assistance is allowed for this task.",
      do: {
        artworkSrc: "/assets/policy-scenes/unsw-do-quick-guide.jpg",
        artworkAlt: "Hand-lettered Do comic: check the assessment category, acknowledge AI use, and keep private information out of prompts.",
        checks: [
          { text: "Check this assessment's AI category.", evidenceHref: "#snapshot-coursework" },
          { text: "Acknowledge AI use in assessment.", evidenceHref: "#snapshot-disclosure" },
          { text: "Keep private information out of prompts.", evidenceHref: "#snapshot-privacy_data" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/unsw-dont-quick-guide.jpg",
        artworkAlt: "Hand-lettered Don't comic: do not use AI in no-assistance work, skip acknowledgement, or assume tool access is task permission.",
        checks: [
          { text: "Don't use AI in No Assistance work.", evidenceHref: "#snapshot-coursework" },
          { text: "Don't skip the required acknowledgement.", evidenceHref: "#snapshot-disclosure" },
          { text: "Tool access is not task permission.", evidenceHref: "#snapshot-approved_tools" }
        ]
      }
    },
    storyCards: [
      {
        title: "Find your assessment's AI category",
        summary: "UNSW categories include tasks with no AI assistance and tasks that permit specified support. Read this assessment's instructions before opening a tool.",
        artworkAlt: "Comic scene: a student compares four blank assessment category cards before opening AI; image text says Check the Category and Before you use AI.",
        artworkSrc: "/assets/policy-scenes/unsw-assessment-category.jpg",
        evidenceHref: "#snapshot-coursework"
      },
      {
        title: "Acknowledge AI in assessment",
        summary: "UNSW requires students to acknowledge AI and other sources in assessment work, even when the task permits AI assistance.",
        artworkAlt: "Comic scene: a student adds an acknowledgement beside an assessment; text says Name your sources and Acknowledge AI in assessment.",
        artworkSrc: "/assets/policy-scenes/unsw-sources.jpg",
        evidenceHref: "#snapshot-disclosure"
      },
      {
        title: "Keep private information out",
        summary: "UNSW advises students not to include personal, sensitive, or intellectual-property information in AI prompts.",
        artworkAlt: "Comic scene: a student holds a private folder away from an AI screen; text says Private info and Keep it out of prompts.",
        artworkSrc: "/assets/policy-scenes/unsw-privacy.jpg",
        evidenceHref: "#snapshot-privacy_data"
      },
      {
        title: "Tool access is not task permission",
        summary: "UNSW lists Microsoft Copilot Chat as an institutionally licensed service. Your assessment's AI category still decides whether you may use it for that task.",
        artworkAlt: "Comic scene: a student pauses at a university AI workspace to check a separate assessment brief; text says Tool Access and Check assessment rules too.",
        artworkSrc: "/assets/policy-scenes/unsw-tool-access.jpg",
        evidenceHref: "#snapshot-approved_tools"
      }
    ]
  },
  "university-of-sydney": {
    slug: "university-of-sydney",
    eyebrow: "Start with your unit",
    title: "Let your unit instructions guide AI use.",
    guidance: "",
    evidenceLabel: "Read the reviewed policy snapshot",
    evidenceHref: "#student-policy-heading",
    artworkAlt: "Two-panel comic: a student checks open-assessment unit rules and does not carry those rules into a supervised test.",
    artworkSrc: "/assets/policy-scenes/sydney-comic.jpg",
    artworkContainsText: true,
    artworkSquare: true,
    quickGuide: {
      scopeNote: "The open-assessment default does not cover supervised exams or tests.",
      do: {
        artworkSrc: "/assets/policy-scenes/sydney-do-quick-guide.jpg",
        artworkAlt: "Hand-lettered Do comic: check your unit rule, acknowledge AI tools, and protect sensitive data.",
        checks: [
          { text: "Check this unit's assessment rule.", evidenceHref: "#snapshot-coursework" },
          { text: "Acknowledge generative tools you use.", evidenceHref: "#snapshot-disclosure" },
          { text: "Keep sensitive data out of AI tools.", evidenceHref: "#snapshot-privacy_data" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/sydney-dont-quick-guide.jpg",
        artworkAlt: "Hand-lettered Don't comic: do not copy open-assessment rules to supervised tests, skip tool acknowledgement, or enter sensitive data in AI.",
        checks: [
          { text: "Don't apply the open-assessment default to supervised tests.", evidenceHref: "#snapshot-exams" },
          { text: "Don't omit generative translation or paraphrasing tools.", evidenceHref: "#snapshot-disclosure" },
          { text: "Don't enter sensitive information into AI tools.", evidenceHref: "#snapshot-privacy_data" }
        ]
      }
    },
    storyCards: [
      {
        title: "Supervised tests have their own rule",
        summary: "Sydney's open-assessment default does not cover supervised exams or supervised in-semester tests. Follow the instructions for that test.",
        artworkAlt: "Comic scene: a student reads a supervised-test instruction sheet outside an exam room; image text says Supervised Test and Follow its own AI rule.",
        artworkSrc: "/assets/policy-scenes/sydney-supervised-test.jpg",
        evidenceHref: "#snapshot-exams"
      },
      {
        title: "Acknowledge generative tools",
        summary: "Sydney's assessment acknowledgement rule includes generative translation, paraphrasing, and referencing tools.",
        artworkAlt: "Comic scene: a student prepares an acknowledgement beside a translation draft; text says Acknowledge AI and Translation tools count.",
        artworkSrc: "/assets/policy-scenes/sydney-acknowledge.jpg",
        evidenceHref: "#snapshot-disclosure"
      },
      {
        title: "Keep sensitive data out of AI",
        summary: "Sydney's guardrails say confidential, personal, proprietary, and other sensitive information should not be entered into AI tools.",
        artworkAlt: "Comic scene: a student closes a sensitive folder before using an AI tool; text says Sensitive data and Keep it out of AI tools.",
        artworkSrc: "/assets/policy-scenes/sydney-sensitive.jpg",
        evidenceHref: "#snapshot-privacy_data"
      }
    ]
  },
  "national-university-of-singapore": {
    slug: "national-university-of-singapore",
    eyebrow: "Assessment setting matters",
    title: "Check how this task assesses your work.",
    guidance: "",
    evidenceLabel: "Read the reviewed policy snapshot",
    evidenceHref: "#student-policy-heading",
    artworkAlt: "Comic: a student checks an assessment brief, uses AI in one task setting, and demonstrates independent understanding in another.",
    artworkSrc: "/assets/policy-scenes/nus-mechanism-hero.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    quickGuide: {
      scopeNote: "Unsupervised work defaults to acknowledged AI use; each assessment's design and instructions still matter.",
      do: {
        artworkSrc: "/assets/policy-scenes/nus-mechanism-do.jpg",
        artworkLandscape: true,
        artworkAlt: "Comic titled Check, Use, Acknowledge: the student reads the task, uses AI, then records that use.",
        checks: [
          { text: "For unsupervised work, check for any task restriction.", evidenceHref: "#snapshot-exams" },
          { text: "Acknowledge the AI use in your submission.", evidenceHref: "#snapshot-disclosure" },
          { text: "Show your own reasoning and judgment.", evidenceHref: "https://ctlt.nus.edu.sg/policy-for-use-of-ai-in-teaching-and-learning.pdf" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/nus-mechanism-dont.jpg",
        artworkLandscape: true,
        artworkAlt: "Comic titled Do Not Pass It Off: the student stops before submitting unacknowledged AI-generated work as their own.",
        checks: [
          { text: "Don't submit unacknowledged AI output as your own.", evidenceHref: "#snapshot-coursework" },
          { text: "Don't assume a supervised part has the take-home default.", evidenceHref: "#snapshot-exams" },
          { text: "Don't treat a detector verdict as proof of misconduct.", evidenceHref: "https://ctlt.nus.edu.sg/policy-for-use-of-ai-in-teaching-and-learning.pdf" }
        ]
      }
    },
    storyCards: [
      {
        placement: "exams",
        title: "Example: one assessment, two task rules",
        summary: "An assessment may mix an independent demonstration and an unsupervised component. This illustration is an example; read the rules for your actual task.",
        artworkAlt: "Example comic: the same student demonstrates understanding in one component and records AI use in a take-home component.",
        artworkSrc: "/assets/policy-scenes/nus-mechanism-mixed.jpg",
        artworkLandscape: true,
        evidenceHref: "#snapshot-exams"
      },
      {
        placement: "coursework",
        title: "Detector output is not disciplinary evidence",
        summary: "NUS says an AI-detector verdict is inadmissible as evidence to charge academic dishonesty or justify a penalty. An unacknowledged AI-generated submission can still be misconduct when the case is made.",
        artworkAlt: "Comic: a detector verdict is set aside while a student presents their work record.",
        artworkSrc: "/assets/policy-scenes/nus-mechanism-detector.jpg",
        artworkLandscape: true,
        evidenceHref: "https://ctlt.nus.edu.sg/policy-for-use-of-ai-in-teaching-and-learning.pdf"
      }
    ]
  },
  "university-of-oxford": {
    slug: "university-of-oxford",
    eyebrow: "Assessment and thesis rules",
    title: "Read the AI declaration for this work.",
    guidance: "",
    evidenceLabel: "Read the reviewed policy snapshot",
    evidenceHref: "#student-policy-heading",
    artworkAlt: "Two-panel comic: a student checks an assessment's AI declaration and keeps AI from substantive PGR thesis writing.",
    artworkSrc: "/assets/policy-scenes/oxford-comic.jpg",
    artworkContainsText: true,
    artworkSquare: true,
    quickGuide: {
      scopeNote: "Each summative assessment sets its own AI rule; PGR guidance has a narrower scope.",
      do: {
        artworkSrc: "/assets/policy-scenes/oxford-do-quick-guide.jpg",
        artworkAlt: "Hand-lettered Do comic: read the AI declaration, acknowledge AI use, and protect confidential data.",
        checks: [
          { text: "Read this assessment's AI declaration.", evidenceHref: "#snapshot-coursework" },
          { text: "Follow the required acknowledgement.", evidenceHref: "#snapshot-disclosure" },
          { text: "Use approved protected tools for confidential University data.", evidenceHref: "#snapshot-privacy_data" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/oxford-dont-quick-guide.jpg",
        artworkAlt: "Hand-lettered Don't comic: do not break the assessment rule, skip required acknowledgement, or put private data in unapproved AI.",
        checks: [
          { text: "Don't use AI contrary to the assessment rule.", evidenceHref: "#snapshot-exams" },
          { text: "Don't skip required acknowledgement.", evidenceHref: "#snapshot-disclosure" },
          { text: "Don't put confidential data in unapproved tools.", evidenceHref: "#snapshot-privacy_data" }
        ]
      }
    },
    storyCards: [
      {
        title: "Read the summative-assessment declaration",
        summary: "Oxford requires each summative assessment to specify permitted and forbidden AI assistance. Follow the declaration for this particular work.",
        artworkAlt: "Comic scene: a student reads a blank summative-assessment declaration before using AI; image text says Summative Work and Check the AI declaration.",
        artworkSrc: "/assets/policy-scenes/oxford-assessment-declaration.jpg",
        evidenceHref: "#snapshot-coursework"
      },
      {
        title: "PGR thesis statement",
        summary: "Oxford requires a generative-AI use statement in final PGR thesis submissions; this is separate from each assessment's declaration.",
        artworkAlt: "Comic scene: a student places an AI-use statement beside a PGR thesis; text says PGR thesis and Include an AI-use statement.",
        artworkSrc: "/assets/policy-scenes/oxford-pgr-statement.jpg",
        evidenceHref: "#snapshot-disclosure"
      },
      {
        title: "Use approved tools for confidential data",
        summary: "Oxford restricts confidential University data to approved protected platforms. An approved tool does not itself permit AI use in an assessment.",
        artworkAlt: "Comic scene: a student keeps a confidential folder beside a protected AI workspace; text says Confidential data and Use approved protected tools.",
        artworkSrc: "/assets/policy-scenes/oxford-protected.jpg",
        evidenceHref: "#snapshot-privacy_data"
      },
      {
        title: "PGR assessments: make your own plots",
        summary: "Oxford PGR guidance prohibits producing plots or data visualisations directly from AI prompts for summative work. This rule is specific to PGR assessments.",
        artworkAlt: "Comic scene: a PGR student sets aside an AI-generated plot and works from their own graph sketch; text says PGR Assessment and No AI-made plots from prompts.",
        artworkSrc: "/assets/policy-scenes/oxford-pgr-plots.jpg",
        evidenceHref: "#snapshot-research_publication"
      }
    ]
  },
  "utrecht-university": {
    slug: "utrecht-university",
    eyebrow: "Look up the course level",
    title: "Find the AI index level for this task.",
    guidance: "",
    evidenceLabel: "Read the reviewed policy snapshot",
    evidenceHref: "#student-policy-heading",
    artworkAlt: "Five illustrated workstations numbered one to five represent Utrecht's task-assigned AI Index levels.",
    artworkSrc: "/assets/policy-scenes/utrecht-mechanism-hero.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    quickGuide: {
      scopeNote: "The instructor assigns a level to the course or task. The Level 2 example applies only when Level 2 is set.",
      do: {
        artworkSrc: "/assets/policy-scenes/utrecht-mechanism-do.jpg",
        artworkLandscape: true,
        artworkAlt: "Level 2 comic: the student uses AI for permitted planning and writes the final work themselves.",
        checks: [
          { text: "Find this task's AI index level.", evidenceHref: "#snapshot-coursework" },
          { text: "At Level 2, plan with AI only when planning isn't assessed; write the final work yourself.", evidenceHref: "https://www.uu.nl/sites/default/files/UU-AI-Index-student-EN.pdf" },
          { text: "Check the tool list as well as the task's level.", evidenceHref: "#snapshot-approved_tools" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/utrecht-mechanism-dont.jpg",
        artworkLandscape: true,
        artworkAlt: "Level 2 comic: the student keeps AI-generated text out of the final submission.",
        checks: [
          { text: "At Level 2, don't submit AI-generated final text.", evidenceHref: "https://www.uu.nl/sites/default/files/UU-AI-Index-student-EN.pdf" },
          { text: "Don't carry one assignment's level into another.", evidenceHref: "#snapshot-coursework" },
          { text: "Don't treat an allow-listed tool as task permission.", evidenceHref: "#snapshot-approved_tools" }
        ]
      }
    },
    storyCards: [
      {
        placement: "coursework",
        title: "Level 3: your work, with AI editing",
        summary: "At Level 3, AI may support editing or feedback while the student remains the author and follows the task's recording instructions.",
        artworkAlt: "Level 3 scene: a student revises their own draft after AI feedback and keeps a prompt record.",
        artworkSrc: "/assets/policy-scenes/utrecht-mechanism-level3.jpg",
        artworkLandscape: true,
        evidenceHref: "https://www.uu.nl/sites/default/files/UU-AI-Index-student-EN.pdf"
      },
      {
        placement: "coursework",
        title: "Level 4: cite the generated part",
        summary: "Level 4 permits AI for specified parts of a task; identify and cite the generated contribution under the assigned instructions.",
        artworkAlt: "Level 4 scene: a student marks and cites the AI-generated part specified by an assignment.",
        artworkSrc: "/assets/policy-scenes/utrecht-mechanism-level4.jpg",
        artworkLandscape: true,
        evidenceHref: "https://www.uu.nl/sites/default/files/UU-AI-Index-student-EN.pdf"
      }
    ]
  },
  "university-of-bristol": {
    slug: "university-of-bristol",
    sourceUpdate: { text: "Current student-source supplement, checked 30 Sep 2026: assessment translation is allowed only when the brief specifically permits it. The older reviewed translation claim below has broader wording and is retained as a dated record, not current assessment permission.", href: "https://www.bristol.ac.uk/students/support/academic-advice/using-artificial-intelligence/" },
    eyebrow: "Assessment category matters",
    title: "Four categories: start with the task, then the default.",
    guidance: "",
    evidenceLabel: "Read the reviewed claims",
    evidenceHref: "#claims",
    artworkAlt: "Student chooses a task brief from four assessment-category pockets; the second pocket represents the conditional default.",
    artworkSrc: "/assets/policy-scenes/bristol-mechanism-hero-v1.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    claimsOnly: true,
    showGallerySummaries: true,
    quickGuide: {
      scopeNote: "These reviewed claims cover taught assessments, not a complete reviewed student snapshot. Category 2 is the default only when no different assessment instructions are given.",
      do: {
        artworkSrc: "/assets/policy-scenes/bristol-mechanism-do-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "Student checks the Category 2 default against a separate assessment brief while keeping their own draft in view.",
        checks: [
          { text: "Check the task category; absent other instructions, Category 2 is the default.", evidenceHref: "#claim-claim-bristol-003" },
          { text: "Check the brief before using translation tools.", evidenceHref: "https://www.bristol.ac.uk/students/support/academic-advice/using-artificial-intelligence/" },
          { text: "Do the work that develops your own thinking.", evidenceHref: "#claim-claim-bristol-001" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/bristol-mechanism-dont-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "Student puts aside a generated draft and works through their own argument; the warning concerns outsourcing thinking.",
        checks: [
          { text: "Don't use AI in a Category 1 assessment.", evidenceHref: "#claim-claim-bristol-003" },
          { text: "Do not treat the AI default as translation permission.", evidenceHref: "https://www.bristol.ac.uk/students/support/academic-advice/using-artificial-intelligence/" },
          { text: "Don't let AI replace your own problem solving.", evidenceHref: "#claim-claim-bristol-001" }
        ]
      }
    },
    storyCards: [
      {
        title: "Category 2: default, unless the task says otherwise",
        summary: "For taught assessments, Category 2 (Minimal) is the default when no other instructions are given. A task-specific category takes precedence; Category 3 defines selected uses and Category 4 requires specified AI use.",
        artworkAlt: "Student compares a Category 2 default card with a separate assessment brief; text says Default, then task rule.",
        artworkSrc: "/assets/policy-scenes/bristol-mechanism-default-v1.jpg",
        artworkLandscape: true,
        evidenceHref: "#claim-claim-bristol-003"
      },
      {
        title: "Translation tool limit",
        summary: "The current student guidance requires the assessment brief to specifically allow translation tools. The older reviewed integrity claim has broader wording; do not infer translation permission from it.",
        artworkAlt: "Comic scene: a student checks an assessment brief before using a translation tool; text says Translation tools and Check the task limit.",
        artworkSrc: "/assets/policy-scenes/bristol-translation.jpg",
        evidenceHref: "https://www.bristol.ac.uk/students/support/academic-advice/using-artificial-intelligence/"
      },
      {
        audience: "research",
        title: "Research degree writing",
        summary: "Bristol's research-degree guidance says GenAI must not write text used in a thesis or APM report.",
        artworkAlt: "Comic scene: a PGR student writes thesis text without an AI draft; text says PGR thesis and No AI-written thesis text.",
        artworkSrc: "/assets/policy-scenes/bristol-pgr.jpg",
        evidenceHref: "#claim-claim-bristol-004"
      }
    ]
  },
  manchester: {
    slug: "manchester",
    eyebrow: "Before you submit",
    title: "Check your course rule and acknowledge AI use.",
    guidance: "",
    evidenceLabel: "Read the reviewed claims",
    evidenceHref: "#claims",
    artworkAlt:
      "Two-panel comic: a student fixes grammar without changing meaning, then keeps AI-written work out of their own submission. Captions say Can, with limits and Do not.",
    artworkSrc: "/assets/policy-scenes/manchester-comic.jpg",
    artworkContainsText: true,
    artworkSquare: true,
    snapshotNotice: noSnapshotNotice,
    quickGuide: {
      scopeNote: "From reviewed claims, not a complete student policy snapshot. Unit rules may differ.",
      do: {
        artworkSrc: "/assets/policy-scenes/manchester-do-quick-guide.jpg",
        artworkAlt: "Hand-lettered Do comic: check your unit rule, acknowledge AI outputs, and keep proofreading to grammar.",
        checks: [
          { text: "Check your unit's AI rule.", evidenceHref: "#claim-CL-008" },
          { text: "Cite or acknowledge AI outputs you use.", evidenceHref: "#claim-CL-010" },
          { text: "Proofread grammar; keep your meaning.", evidenceHref: "#claim-CL-009" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/manchester-dont-quick-guide.jpg",
        artworkAlt: "Hand-lettered Don't comic: do not submit AI work as your own, change meaning while proofreading, or share sensitive data in public AI.",
        checks: [
          { text: "Don't submit AI work as your own.", evidenceHref: "#claim-CL-006" },
          { text: "Don't let proofreading rewrite your work.", evidenceHref: "#claim-CL-009" },
          { text: "Keep disclosure-risk data out of public AI.", evidenceHref: "#claim-CL-005" }
        ]
      }
    },
    storyCards: [
      {
        title: "Proofread without changing your meaning",
        summary: "Manchester allows grammar and spelling corrections that do not substantively change the content or meaning. Check the rule for your unit as well.",
        artworkAlt: "Comic scene: a student corrects spelling on their own draft without replacing the substance; image text says Proofreading and Keep the meaning yours.",
        artworkSrc: "/assets/policy-scenes/manchester-proofreading.jpg",
        evidenceHref: "#claim-CL-009"
      },
      {
        title: "Check your unit",
        summary: "With School-level approval, a specific course unit may broaden or narrow Manchester's default AI position. Read that unit's instructions.",
        artworkAlt: "Comic scene: a student and instructor inspect a course-unit brief; image text says Check your unit and AI rules may vary by course.",
        artworkSrc: "/assets/policy-scenes/manchester-unit.jpg",
        evidenceHref: "#claim-CL-008"
      },
      {
        title: "Disclosure risk?",
        summary: "When AI use risks inappropriate disclosure of information, use university-approved enterprise tools rather than publicly available ones.",
        artworkAlt: "Comic scene: a student holds back a folder before choosing a protected AI tool; image text says Disclosure risk? and Use university-approved enterprise AI.",
        artworkSrc: "/assets/policy-scenes/manchester-data.jpg",
        evidenceHref: "#claim-CL-005"
      },
      {
        title: "Cite or acknowledge AI outputs",
        summary: "Manchester asks students to cite or acknowledge generative AI outputs used in their work, including editing, translating, rewriting, and idea generation. Check whether the use is permitted for your unit.",
        artworkAlt: "Comic scene: a student adds an acknowledgement slip to their own assignment beside a separate AI chat; text says Used AI? and Cite or acknowledge outputs.",
        artworkSrc: "/assets/policy-scenes/manchester-acknowledge.jpg",
        evidenceHref: "#claim-CL-010"
      }
    ]
  },
  edinburgh: {
    slug: "edinburgh",
    eyebrow: "Before handing it in",
    title: "Check the assessment rule before submission.",
    guidance: "",
    evidenceLabel: "Read the reviewed claims",
    evidenceHref: "#claims",
    artworkAlt: "Two-panel comic: a student acknowledges GenAI use before submitting and does not present AI work as their own.",
    artworkSrc: "/assets/policy-scenes/edinburgh-comic.jpg",
    artworkContainsText: true,
    artworkSquare: true,
    snapshotNotice: noSnapshotNotice,
    quickGuide: {
      scopeNote: "Based on reviewed claims, not a complete student policy snapshot. Assessment restrictions may differ.",
      do: {
        artworkSrc: "/assets/policy-scenes/edinburgh-do-quick-guide.jpg",
        artworkAlt: "Hand-lettered Do comic: check the assessment rule, acknowledge GenAI use, and keep your work original.",
        checks: [
          { text: "Check this course or assessment's AI rule.", evidenceHref: "#claim-claim-edinburgh-registry-04-20260727" },
          { text: "Acknowledge GenAI before submission.", evidenceHref: "#claim-claim-edinburgh-registry-03-20260727" },
          { text: "Make your assessed work your own.", evidenceHref: "#claim-claim-edinburgh-registry-02-20260727" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/edinburgh-dont-quick-guide.jpg",
        artworkAlt: "Hand-lettered Don't comic: do not submit AI work as your own, send AI agents into Learn, or use third-party AI translation in class.",
        checks: [
          { text: "Don't present AI work as your own.", evidenceHref: "#claim-claim-edinburgh-registry-02-20260727" },
          { text: "Don't let AI agents work inside Learn.", evidenceHref: "#claim-claim-edinburgh-004" },
          { text: "Don't use third-party AI translation apps in class.", evidenceHref: "#claim-claim-edinburgh-006" }
        ]
      }
    },
    storyCards: [
      {
        title: "Acknowledge GenAI before submission",
        summary: "Edinburgh's reviewed student guidance requires students to acknowledge any GenAI use before submitting assessed work.",
        artworkAlt: "Comic scene: a student adds an acknowledgement slip to their own assignment; image text says Before Submitting and Acknowledge GenAI use.",
        artworkSrc: "/assets/policy-scenes/edinburgh-acknowledge.jpg",
        evidenceHref: "#claim-claim-edinburgh-registry-03-20260727"
      },
      {
        title: "Do VLE work yourself",
        summary: "Edinburgh says AI agents or AI browsers must not complete work inside virtual learning environments.",
        artworkAlt: "Comic scene: a student keeps an AI browser agent out of a learning portal; text says VLE work and No AI agents inside.",
        artworkSrc: "/assets/policy-scenes/edinburgh-vle.jpg",
        evidenceHref: "#claim-claim-edinburgh-004"
      },
      {
        title: "ELM access and task rules",
        summary: "Edinburgh offers ELM as its own safer AI access platform. Assessment and course instructions still decide permitted use.",
        artworkAlt: "Comic scene: a student checks a course brief beside a university AI workspace; text says ELM access and Check task rules separately.",
        artworkSrc: "/assets/policy-scenes/edinburgh-elm.jpg",
        evidenceHref: "#claim-CL-005"
      },
      {
        title: "In class: no third-party AI translation apps",
        summary: "Edinburgh student guidance says third-party AI-based translation apps must not be used in class. This is an in-class rule for those apps.",
        artworkAlt: "Comic scene: a student lowers a live-translation phone and takes their own class notes; text says In Class and No third-party AI translation apps.",
        artworkSrc: "/assets/policy-scenes/edinburgh-class-translation.jpg",
        evidenceHref: "#claim-claim-edinburgh-006"
      }
    ]
  },
  "deakin-university": {
    slug: "deakin-university",
    eyebrow: "Keep track of your process",
    title: "Check the task, then document your process.",
    guidance: "",
    evidenceLabel: "Read the reviewed claims",
    evidenceHref: "#claims",
    artworkAlt: "Two-panel comic: a student uses AI for early study ideas but keeps AI from writing final assessed work.",
    artworkSrc: "/assets/policy-scenes/deakin-comic.jpg",
    artworkContainsText: true,
    artworkSquare: true,
    snapshotNotice: noSnapshotNotice,
    quickGuide: {
      scopeNote: "Based on reviewed claims, not a complete student policy snapshot. Check the rule for this task.",
      do: {
        artworkSrc: "/assets/policy-scenes/deakin-do-quick-guide.jpg",
        artworkAlt: "Hand-lettered Do comic: use AI for early ideas where allowed, log prompts and outputs, and write your own final work.",
        checks: [
          { text: "Use AI for early ideas only where the task allows.", evidenceHref: "#claim-claim-deakin-assessment-own-work" },
          { text: "Log contributing AI tools, prompts and outputs.", evidenceHref: "#claim-claim-deakin-acknowledge-genai" },
          { text: "Write your final assessed work yourself.", evidenceHref: "#claim-claim-deakin-assessment-own-work" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/deakin-dont-quick-guide.jpg",
        artworkAlt: "Hand-lettered Don't comic: do not let AI write final work, do the assessed task, or skip acknowledgement.",
        checks: [
          { text: "Don't let AI write your final assessment.", evidenceHref: "#claim-claim-deakin-assessment-own-work" },
          { text: "Don't let AI do the work being assessed.", evidenceHref: "#claim-claim-deakin-assessment-own-work" },
          { text: "Don't omit contributing AI from your acknowledgement.", evidenceHref: "#claim-claim-deakin-acknowledge-genai" }
        ]
      }
    },
    storyCards: [
      {
        title: "Write your own final assessment",
        summary: "Deakin allows AI to start ideas for some study tasks, but not to write final assessed work or do the work being assessed.",
        artworkAlt: "Comic scene: a student writes their own final assessment beside a separate brainstorm sketch; image text says Final Assessment and Do your own work.",
        artworkSrc: "/assets/policy-scenes/deakin-own-work.jpg",
        evidenceHref: "#claim-claim-deakin-assessment-own-work"
      },
      {
        title: "Track your AI use",
        summary: "Deakin asks students to acknowledge contributing AI use, including the tool, access date, prompts, output, and where it was used.",
        artworkAlt: "Comic scene: a student logs AI prompts and output while developing assessed work; text says Track AI use and Log prompts and outputs.",
        artworkSrc: "/assets/policy-scenes/deakin-log.jpg",
        evidenceHref: "#claim-claim-deakin-acknowledge-genai"
      },
      {
        audience: "research",
        title: "HDR thesis limit",
        summary: "For Deakin HDR theses, GenAI use is limited to copyediting and proofreading; students write the substantive thesis themselves.",
        artworkAlt: "Comic scene: a researcher copyedits a human-written thesis page; text says HDR thesis and Copyedit and proofread only.",
        artworkSrc: "/assets/policy-scenes/deakin-hdr.jpg",
        evidenceHref: "#claim-claim-deakin-hdr-thesis-genai"
      }
    ]
  },
  "university-of-surrey": {
    slug: "university-of-surrey",
    eyebrow: "Start with this assessment",
    title: "Check the brief before you use AI.",
    guidance: "",
    evidenceLabel: "Read the reviewed claims",
    evidenceHref: "#claims",
    artworkAlt: "Two-panel comic: a student checks an assessment brief, then keeps protected data away from a tool until its approval is known.",
    artworkSrc: "/assets/policy-scenes/surrey-hero.jpg",
    artworkContainsText: true,
    artworkSquare: true,
    snapshotNotice: noSnapshotNotice,
    quickGuide: {
      scopeNote: "These are checks from reviewed Surrey statements, not a complete student permission list. The assessment brief or module leader sets the task rule.",
      do: {
        artworkSrc: "/assets/policy-scenes/surrey-do-quick-guide.jpg",
        artworkAlt: "Illustrated Do guide: check the brief, read the GenAI procedure, and check tool approval for protected data.",
        checks: [
          { text: "Check this assessment's AI brief.", evidenceHref: "#claim-claim-surrey-student-assessment-check" },
          { text: "Read Surrey's GenAI procedure.", evidenceHref: "#claim-claim-surrey-genai-procedure-scope" },
          { text: "Check tool approval before sharing protected data.", evidenceHref: "#claim-claim-surrey-approved-tools-data" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/surrey-dont-quick-guide.jpg",
        artworkAlt: "Illustrated Don't guide: do not skip module instructions, upload protected data to an unapproved tool, or treat tool access as task permission.",
        checks: [
          { text: "Don't skip the module or assessment rule.", evidenceHref: "#claim-claim-surrey-student-assessment-check" },
          { text: "Don't upload protected data to an unapproved tool.", evidenceHref: "#claim-claim-surrey-approved-tools-data" },
          { text: "Tool access alone does not decide this task's rule.", evidenceHref: "#claim-claim-surrey-student-assessment-check" }
        ]
      }
    },
    storyCards: [
      {
        title: "Ask what this assessment allows",
        summary: "Surrey directs students to their assessment brief or module leader for the level of AI use permitted in a specific task.",
        artworkAlt: "Student checks an assessment brief with a module leader; image text says Assessment Brief and Ask what this task allows.",
        artworkSrc: "/assets/policy-scenes/surrey-brief.jpg",
        evidenceHref: "#claim-claim-surrey-student-assessment-check"
      },
      {
        title: "Check data and tool approval",
        summary: "Surrey's procedure restricts personal, confidential and commercially sensitive information to tools approved for that data.",
        artworkAlt: "Student holds a protected folder away from an AI screen; image text says Private Data and Check tool approval first.",
        artworkSrc: "/assets/policy-scenes/surrey-data.jpg",
        evidenceHref: "#claim-claim-surrey-approved-tools-data"
      }
    ]
  },
  "imperial-college-london": {
    slug: "imperial-college-london",
    eyebrow: "Start with your department",
    title: "Tool access and task permission are separate checks.",
    guidance: "",
    evidenceLabel: "Read the reviewed policy snapshot",
    evidenceHref: "#student-policy-heading",
    artworkAlt: "Student compares a department assessment brief with a separate tool access screen in a computer lab.",
    artworkSrc: "/assets/policy-scenes/imperial-mechanism-hero-v1.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    showGallerySummaries: true,
    quickGuide: {
      scopeNote: "Imperial departments decide AI use for specific assessments. dAIsy access does not replace the task rule.",
      do: {
        artworkSrc: "/assets/policy-scenes/imperial-mechanism-do-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "Student writes an AI-use statement beside their assessed work after consulting the task brief.",
        checks: [
          { text: "Follow your department's assessment rule.", evidenceHref: "#snapshot-coursework" },
          { text: "Include the required AI-use statement.", evidenceHref: "#snapshot-disclosure" },
          { text: "Name the tool and explain how you used it.", evidenceHref: "#snapshot-disclosure" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/imperial-mechanism-dont-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "Student stops an access card from being mistaken for assessment permission.",
        checks: [
          { text: "Don't use AI for assessed work without authorisation.", evidenceHref: "#snapshot-coursework" },
          { text: "Don't omit the AI acknowledgement.", evidenceHref: "#snapshot-disclosure" },
          { text: "Don't treat dAIsy access as task permission.", evidenceHref: "#snapshot-approved_tools" }
        ]
      }
    },
    storyCards: [
      {
        placement: "coursework",
        title: "Follow your department's rule",
        summary: "Departments may allow or prohibit AI for a particular assessment. Check the current brief before using a tool.",
        artworkAlt: "Student reads a department assessment brief; image text says Your Department and Check the assessment rule.",
        artworkSrc: "/assets/policy-scenes/imperial-department.jpg",
        evidenceHref: "#snapshot-coursework"
      },
      {
        placement: "disclosure",
        title: "Describe your AI use",
        summary: "Imperial asks for an AI-use acknowledgement in assessed work, with details such as the tool and how it was used.",
        artworkAlt: "Student adds an acknowledgement to assessed work; image text says AI Statement and Describe how you used it.",
        artworkSrc: "/assets/policy-scenes/imperial-acknowledge.jpg",
        evidenceHref: "#snapshot-disclosure"
      },
      {
        placement: "approved_tools",
        title: "Keep tool access separate from task rules",
        summary: "Imperial provides dAIsy, but access to it does not by itself authorise its use for an assessment.",
        artworkAlt: "Student uses a generic university AI workspace beside study papers; image text says Tool Access.",
        artworkSrc: "/assets/policy-scenes/imperial-tool.jpg",
        evidenceHref: "#snapshot-approved_tools"
      }
    ]
  },
  "adelaide-university": {
    slug: "adelaide-university",
    eyebrow: "Start with your course",
    title: "An assignment rule does not carry into an exam.",
    guidance: "",
    evidenceLabel: "Read the reviewed policy snapshot",
    evidenceHref: "#student-policy-heading",
    artworkAlt: "Student pauses between an assignment desk and an invigilated exam station to read the new task instructions.",
    artworkSrc: "/assets/policy-scenes/adelaide-mechanism-hero-v1.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    showGallerySummaries: true,
    quickGuide: {
      scopeNote: "Course coordinators set assessment instructions. Invigilated online exams permit only tools explicitly approved in exam instructions.",
      do: {
        artworkSrc: "/assets/policy-scenes/adelaide-mechanism-do-v3.jpg",
        artworkLandscape: true,
        artworkAlt: "Student reads the permitted tools for this invigilated online exam before opening the laptop.",
        checks: [
          { text: "Follow your course coordinator's AI instructions.", evidenceHref: "#snapshot-coursework" },
          { text: "Read the exam's permitted-tools list.", evidenceHref: "#snapshot-exams" },
          { text: "Acknowledge AI-generated information as required.", evidenceHref: "#snapshot-disclosure" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/adelaide-mechanism-dont-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "Student puts aside an assignment permission brief before consulting separate exam rules.",
        checks: [
          { text: "Don't use unapproved AI in an invigilated online exam.", evidenceHref: "#snapshot-exams" },
          { text: "Don't present AI-produced work as your own.", evidenceHref: "#snapshot-coursework" },
          { text: "A tool listing is not task permission.", evidenceHref: "#snapshot-approved_tools" }
        ]
      }
    },
    storyCards: [
      {
        placement: "coursework",
        title: "Ask the course coordinator",
        summary: "Follow this course's directions for appropriate AI assistance on the assessment.",
        artworkAlt: "Student checks an assessment with a course coordinator; image text says Course Rule and Ask the coordinator.",
        artworkSrc: "/assets/policy-scenes/adelaide-course.jpg",
        evidenceHref: "#snapshot-coursework"
      },
      {
        placement: "exams",
        title: "Read the exam tool list",
        summary: "For invigilated online exams, AI tools such as ChatGPT are not permitted unless the instructions explicitly approve them.",
        artworkAlt: "Student closes an AI laptop before an invigilated online exam and reads a permitted-tools sheet; image text says Online Exam and Only approved tools.",
        artworkSrc: "/assets/policy-scenes/adelaide-exam.jpg",
        evidenceHref: "#snapshot-exams"
      },
      {
        placement: "disclosure",
        title: "Acknowledge AI-generated information",
        summary: "Do not submit AI-produced work as your own or omit the acknowledgement required for the assessment.",
        artworkAlt: "Student adds an acknowledgement beside an assignment; image text says Used AI? and Acknowledge it.",
        artworkSrc: "/assets/policy-scenes/adelaide-acknowledge.jpg",
        evidenceHref: "#snapshot-disclosure"
      }
    ]
  },
  "de-la-salle-university": {
    slug: "de-la-salle-university",
    eyebrow: "Start with the syllabus",
    title: "Check the level for this graded part.",
    guidance: "",
    evidenceLabel: "Read the reviewed policy snapshot",
    evidenceHref: "#student-policy-heading",
    artworkAlt: "Comic rubric with Free, Specific and Banned labels on separate graded components; the student checks one component's rule.",
    artworkSrc: "/assets/policy-scenes/dlsu-mechanism-hero.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    quickGuide: {
      scopeNote: "Free, Specific Contexts and Banned apply by graded component; an individual task may set a narrower rule.",
      do: {
        artworkSrc: "/assets/policy-scenes/dlsu-mechanism-do.jpg",
        artworkLandscape: true,
        artworkAlt: "Comic titled Follow This Component: a student reads the selected graded component's AI rule and records their use.",
        checks: [
          { text: "Check the GenAI level for this graded component.", evidenceHref: "#snapshot-coursework" },
          { text: "Follow any task-specific instruction.", evidenceHref: "https://old.dlsu.edu.ph/wp-content/uploads/pdf/provost/forms/policy-for-generative-ai-in-education.pdf" },
          { text: "Disclose permitted GenAI use in writing.", evidenceHref: "#snapshot-disclosure" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/dlsu-mechanism-dont.jpg",
        artworkLandscape: true,
        artworkAlt: "Comic titled Disclosure Does Not Override: a student checks the task restriction before using AI in a submission.",
        checks: [
          { text: "Don't use GenAI in a Banned component.", evidenceHref: "https://old.dlsu.edu.ph/wp-content/uploads/pdf/provost/forms/policy-for-generative-ai-in-education.pdf" },
          { text: "A disclosure does not override a task restriction.", evidenceHref: "#snapshot-coursework" },
          { text: "Don't omit disclosure when you do use GenAI.", evidenceHref: "#snapshot-disclosure" }
        ]
      }
    },
    storyCards: [
      {
        placement: "coursework",
        title: "Specific Contexts means a limited use",
        summary: "Where a component specifies a context, use GenAI only for the defined stage or purpose. Follow any narrower task instruction.",
        artworkAlt: "Comic: a student uses AI for a limited step and continues the assignment with their own work; text says Specific Means Specific.",
        artworkSrc: "/assets/policy-scenes/dlsu-mechanism-specific.jpg",
        artworkLandscape: true,
        evidenceHref: "https://old.dlsu.edu.ph/wp-content/uploads/pdf/provost/forms/policy-for-generative-ai-in-education.pdf"
      },
      {
        title: "Disclose use in writing",
        summary: "DLSU asks for a written disclosure when GenAI contributes to submitted material. The illustration shows one way to integrate it; a separate sheet is not always required.",
        artworkAlt: "Comic: a student writes a disclosure within a submission instead of assuming a separate sheet is always needed.",
        artworkSrc: "/assets/policy-scenes/dlsu-mechanism-disclosure.jpg",
        artworkLandscape: true,
        evidenceHref: "#snapshot-disclosure"
      },
      {
        title: "A detector result is not proof by itself",
        summary: "DLSU says an AI detector result alone cannot establish GenAI-related academic dishonesty. Prohibited use and missing disclosure still matter.",
        artworkAlt: "Student and instructor review an AI detector output alongside an assignment; image text says AI Detector and Not proof by itself.",
        artworkSrc: "/assets/policy-scenes/dlsu-detector.jpg",
        evidenceHref: "#snapshot-coursework"
      }
    ]
  },
  ubc: {
    slug: "ubc",
    eyebrow: "Start with permission",
    title: "Ask before using AI in assessed work.",
    guidance: "",
    evidenceLabel: "Read the reviewed policy snapshot",
    evidenceHref: "#student-policy-heading",
    artworkAlt: "Two-panel comic: a student asks for express permission on assessed work and checks whether a tool has passed the privacy assessment before sharing personal data.",
    artworkSrc: "/assets/policy-scenes/ubc-hero.jpg",
    artworkContainsText: true,
    artworkSquare: true,
    quickGuide: {
      scopeNote: "UBC requires express permission for GenAI in assessed work, including exams. Tool access and privacy clearance are separate checks.",
      do: {
        artworkSrc: "/assets/policy-scenes/ubc-do-quick-guide.jpg",
        artworkAlt: "Illustrated Do guide: get express permission, follow acknowledgement instructions, and check privacy assessment.",
        checks: [
          { text: "Get express permission for this assessed work.", evidenceHref: "#snapshot-coursework" },
          { text: "Follow the required acknowledgement method.", evidenceHref: "#snapshot-disclosure" },
          { text: "Check a tool's FIPPA assessment for personal data.", evidenceHref: "#snapshot-privacy_data" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/ubc-dont-quick-guide.jpg",
        artworkAlt: "Illustrated Don't guide: no unpermitted AI in exams, no personal data in uncleared tools, and no assumption that access grants assessment permission.",
        checks: [
          { text: "Don't use GenAI in an exam without express permission.", evidenceHref: "#snapshot-exams" },
          { text: "Don't enter personal data into an uncleared tool.", evidenceHref: "#snapshot-privacy_data" },
          { text: "Tool access is not assessment permission.", evidenceHref: "#snapshot-approved_tools" }
        ]
      }
    },
    storyCards: [
      {
        title: "Get permission for this assessment",
        summary: "UBC says GenAI for assessed assignments, projects or theses needs express permission from the instructor, supervisor or program.",
        artworkAlt: "Student asks about an assignment; image text says Assessed Work and Get express permission.",
        artworkSrc: "/assets/policy-scenes/ubc-permission.jpg",
        evidenceHref: "#snapshot-coursework"
      },
      {
        title: "Check the exam rule separately",
        summary: "Exams are also assessed work; do not use GenAI without express permission for that exam.",
        artworkAlt: "Student reads exam instructions before using AI; image text says Exam Rule and Permission comes first.",
        artworkSrc: "/assets/policy-scenes/ubc-exam.jpg",
        evidenceHref: "#snapshot-exams"
      },
      {
        title: "Acknowledge permitted use",
        summary: "When AI use is allowed, follow the acknowledgement method stated by the educator for the task.",
        artworkAlt: "Student records permitted AI use beside an assignment; image text says Permitted AI and Follow the acknowledgement rule.",
        artworkSrc: "/assets/policy-scenes/ubc-acknowledge.jpg",
        evidenceHref: "#snapshot-disclosure"
      },
      {
        title: "Check privacy clearance",
        summary: "UBC says personal information must not be entered into a GenAI tool without the required FIPPA compliance assessment.",
        artworkAlt: "Student keeps a personal-data folder away from an uncleared AI tool; image text says Personal Data and Check FIPPA approval.",
        artworkSrc: "/assets/policy-scenes/ubc-privacy.jpg",
        evidenceHref: "#snapshot-privacy_data"
      }
    ]
  },
  "university-of-queensland": {
    slug: "university-of-queensland",
    eyebrow: "Assessment classification",
    title: "Two assessment types. Check the extra conditions.",
    guidance: "",
    evidenceLabel: "Read official UQ assessment guidance",
    evidenceHref: "https://itali.uq.edu.au/node/11633",
    artworkAlt: "Comic: Secure and Open are two assessment types; AI Required appears as a separate condition, not a third type.",
    artworkSrc: "/assets/policy-scenes/uq-mechanism-hero-v2.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    claimsOnly: true,
    quickGuide: {
      scopeNote: "From UQ's Semester 2 2026 official guidance. This record has no reviewed student-policy snapshot; your course profile and task instructions govern use.",
      do: {
        artworkSrc: "/assets/policy-scenes/uq-mechanism-do.jpg",
        artworkLandscape: true,
        artworkAlt: "Open-assessment comic: a student uses resources and AI while showing their own thinking and judgment.",
        checks: [
          { text: "Find Secure or Open in your course profile.", evidenceHref: "https://itali.uq.edu.au/node/11633" },
          { text: "For Open work, show your own understanding and judgment.", evidenceHref: "https://itali.uq.edu.au/node/11633" },
          { text: "Follow this task's AI acknowledgement instructions.", evidenceHref: "https://itali.uq.edu.au/node/11633" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/uq-mechanism-dont.jpg",
        artworkLandscape: true,
        artworkAlt: "Secure-assessment comic: the student closes a tool that is not listed in the assessment instructions.",
        checks: [
          { text: "For Secure work, use only the tools listed for that task.", evidenceHref: "https://itali.uq.edu.au/node/11633" },
          { text: "Don't treat AI Required as a third assessment type.", evidenceHref: "https://itali.uq.edu.au/node/11633" },
          { text: "Don't assume every task has the same acknowledgement rule.", evidenceHref: "https://itali.uq.edu.au/node/11633" }
        ]
      }
    },
    storyCards: [
      {
        title: "AI Required is an added condition",
        summary: "A task may assess how students select, prompt, verify and integrate AI. AI Required is a condition on the task, not a third base classification beside Secure and Open.",
        artworkAlt: "Comic titled AI Required: Show the Process; a student documents how they selected, used, checked and integrated AI.",
        artworkSrc: "/assets/policy-scenes/uq-mechanism-required.jpg",
        artworkLandscape: true,
        evidenceHref: "https://itali.uq.edu.au/node/11633"
      },
      {
        title: "Acknowledgement follows the task",
        summary: "UQ says the assessment instructions should specify if and how permitted AI use must be acknowledged. Some uses do not require acknowledgement.",
        artworkAlt: "Comic titled Read This Task Rule: a student compares two task instructions before filling in an AI-use acknowledgement.",
        artworkSrc: "/assets/policy-scenes/uq-mechanism-acknowledge.jpg",
        artworkLandscape: true,
        evidenceHref: "https://itali.uq.edu.au/node/11633"
      }
    ]
  },
  "university-of-johannesburg": {
    slug: "university-of-johannesburg",
    eyebrow: "Start with your course",
    title: "Find the rule for your assignment.",
    guidance: "",
    evidenceLabel: "Read the reviewed claims",
    evidenceHref: "#claims",
    artworkAlt: "Two-panel comic: a student checks course and faculty instructions, then acknowledges AI use in an assignment.",
    artworkSrc: "/assets/policy-scenes/uj-hero.jpg",
    artworkContainsText: true,
    artworkSquare: true,
    snapshotNotice: noSnapshotNotice,
    quickGuide: {
      scopeNote: "UJ's reviewed statements point to course, department and faculty rules; they do not form a complete campus-wide permission list.",
      do: {
        artworkSrc: "/assets/policy-scenes/uj-do-quick-guide.jpg",
        artworkAlt: "Illustrated Do guide: read course and faculty rules, acknowledge AI use, and submit your own work.",
        checks: [
          { text: "Read your course and faculty AI rules.", evidenceHref: "#claim-claim-uj-students-follow-course-rules" },
          { text: "Acknowledge AI use where used.", evidenceHref: "#claim-claim-uj-practice-note-ai-academic-dishonesty" },
          { text: "Make your submission your own work.", evidenceHref: "#claim-claim-uj-practice-note-ai-academic-dishonesty" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/uj-dont-quick-guide.jpg",
        artworkAlt: "Illustrated Don't guide: no assumed universal permission, no unacknowledged AI use, and no AI-generated work passed off as the student's own.",
        checks: [
          { text: "Don't assume one rule fits every course.", evidenceHref: "#claim-claim-uj-students-follow-course-rules" },
          { text: "Don't omit an AI-use acknowledgement.", evidenceHref: "#claim-claim-uj-practice-note-ai-academic-dishonesty" },
          { text: "Don't present AI-generated work as your own.", evidenceHref: "#claim-claim-uj-practice-note-ai-academic-dishonesty" }
        ]
      }
    },
    storyCards: [
      {
        title: "Find your local rule",
        summary: "UJ tells students to check course, department, faculty and university rules before producing assignments or assessments.",
        artworkAlt: "Student compares course and faculty instruction sheets; image text says Your Course and Check its AI rule.",
        artworkSrc: "/assets/policy-scenes/uj-course.jpg",
        evidenceHref: "#claim-claim-uj-students-follow-course-rules"
      },
      {
        title: "Acknowledge AI and keep authorship honest",
        summary: "UJ's practice note says AI use should be acknowledged and AI-generated work must not be passed off as the student's own.",
        artworkAlt: "Student adds a blank AI-use note beside an original draft; image text says Used AI? and Acknowledge it.",
        artworkSrc: "/assets/policy-scenes/uj-acknowledge.jpg",
        evidenceHref: "#claim-claim-uj-practice-note-ai-academic-dishonesty"
      }
    ]
  },
  anu: {
    slug: "anu",
    eyebrow: "Start with this assessment",
    title: "Check your course and college rules first.",
    guidance: "",
    evidenceLabel: "Read the reviewed claims",
    evidenceHref: "#claims",
    artworkAlt: "Two-panel comic: an ANU student checks an assessment outline and keeps a personal-information folder away from an AI prompt.",
    artworkSrc: "/assets/policy-scenes/anu-hero.jpg",
    artworkContainsText: true,
    artworkSquare: true,
    snapshotNotice: noSnapshotNotice,
    quickGuide: {
      scopeNote: "Course conveners and colleges may set different assessment rules. ANU Law School's drafting and first-footnote rules apply there, not to all ANU courses.",
      do: {
        artworkSrc: "/assets/policy-scenes/anu-do-quick-guide.jpg",
        artworkAlt: "Illustrated Do guide: check the assessment outline, follow the Law School rule when relevant, and obtain consent before using personal information.",
        checks: [
          { text: "Check your class and assessment outline.", evidenceHref: "#claim-claim-anu-004a" },
          { text: "In Law, declare permitted AI use in the first footnote.", evidenceHref: "#claim-claim-anu-006c" },
          { text: "Get express consent before using personal information.", evidenceHref: "#claim-claim-anu-003a" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/anu-dont-quick-guide.jpg",
        artworkAlt: "Illustrated Don't guide: no assumed cross-course permission, no AI-generated work passed off as original, and no AI drafting for Law graded assignments.",
        checks: [
          { text: "Don't assume one college's rule applies elsewhere.", evidenceHref: "#claim-claim-anu-002d" },
          { text: "Don't present AI-generated content as your own.", evidenceHref: "#claim-claim-anu-002a" },
          { text: "In Law, don't draft graded work with AI.", evidenceHref: "#claim-claim-anu-006a" }
        ]
      }
    },
    storyCards: [
      {
        title: "Check your course convener's rule",
        summary: "ANU course conveners can limit or encourage AI use for a specific assessment. Read the class summary and assessment outline.",
        artworkAlt: "Student reads an assessment outline before using AI; image text says Course Rule and Check this task.",
        artworkSrc: "/assets/policy-scenes/anu-course.jpg",
        evidenceHref: "#claim-claim-anu-004a"
      },
      {
        title: "Law School has a narrower drafting rule",
        summary: "ANU Law School prohibits generative AI drafting for graded assignments. Its guidance separately allows limited expression help and brainstorming under its conditions.",
        artworkAlt: "Law student writes an original draft without an AI writer; image text says Law School and Do not draft with AI.",
        artworkSrc: "/assets/policy-scenes/anu-law.jpg",
        evidenceHref: "#claim-claim-anu-006a"
      },
      {
        title: "Law: declare permitted use",
        summary: "For permitted AI use, ANU Law School requires the first footnote to name the tool, purpose and extent of use.",
        artworkAlt: "Law student adds a blank first footnote to a paper; image text says Law Footnote and Declare permitted use.",
        artworkSrc: "/assets/policy-scenes/anu-footnote.jpg",
        evidenceHref: "#claim-claim-anu-006c"
      },
      {
        title: "Protect personal information",
        summary: "ANU prohibits collecting, using, storing or disclosing personal information with AI without express consent from the people concerned.",
        artworkAlt: "Student keeps a personal-data folder away from an AI prompt; image text says Personal Info and Consent first.",
        artworkSrc: "/assets/policy-scenes/anu-privacy.jpg",
        evidenceHref: "#claim-claim-anu-003a"
      }
    ]
  },
  "durham-university": {
    slug: "durham-university",
    eyebrow: "Start with the assessment tier",
    title: "Find which of Durham's four tiers applies.",
    guidance: "",
    evidenceLabel: "Read the reviewed claims",
    evidenceHref: "#claims",
    artworkAlt: "Student selects their task from four neutral folders labelled No GenAI Allowed, Selective, Allowed and Embedded.",
    artworkSrc: "/assets/policy-scenes/durham-mechanism-hero-v1.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    claimsOnly: true,
    showGallerySummaries: true,
    quickGuide: {
      scopeNote: "This guide uses reviewed claims, without a complete reviewed student snapshot. Check one of four task tiers. Common Awards declaration and originality rules apply only to Common Awards summative modules.",
      do: {
        artworkSrc: "/assets/policy-scenes/durham-mechanism-do-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "Student checks the specific instructions on a Selective assessment before drafting.",
        checks: [
          { text: "Find this assessment's GenAI tier.", evidenceHref: "#claim-claim-du-genai-assessment-categories" },
          { text: "Follow any Selective tier instructions.", evidenceHref: "#claim-claim-du-genai-assessment-categories" },
          { text: "Common Awards: add the AI declaration.", evidenceHref: "#claim-claim-du-common-awards-ai-declaration" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/durham-mechanism-dont-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "Common Awards student sets aside generated substantive content and writes their own argument; the scope is explicitly Common Awards.",
        checks: [
          { text: "Don't use AI in a No GenAI Allowed task.", evidenceHref: "#claim-claim-du-genai-assessment-categories" },
          { text: "Don't transfer one tier to another task.", evidenceHref: "#claim-claim-du-genai-assessment-categories" },
          { text: "Common Awards: don't pass AI content off as yours.", evidenceHref: "#claim-claim-du-common-awards-no-substantive-ai" }
        ]
      }
    },
    storyCards: [
      {
        title: "Find the four-tier label",
        summary: "Durham's assessment tiers are No GenAI Allowed, Selective, Allowed and Embedded. Check the label and task instructions that apply to you.",
        artworkAlt: "Student checks assessment-tier sheets; image text says Four Tiers and Find your task's tier.",
        artworkSrc: "/assets/policy-scenes/durham-tiers.jpg",
        evidenceHref: "#claim-claim-du-genai-assessment-categories"
      },
      {
        title: "Common Awards: declare AI use",
        summary: "For Common Awards summative assignments, Durham requires a completed AI declaration before submission.",
        artworkAlt: "Common Awards student adds a blank declaration to a summative assignment; image text says Common Awards and Add the AI declaration.",
        artworkSrc: "/assets/policy-scenes/durham-declaration.jpg",
        evidenceHref: "#claim-claim-du-common-awards-ai-declaration"
      },
      {
        title: "Common Awards: keep substantive work yours",
        summary: "Common Awards students must not present AI-generated substantive content as their own creation.",
        artworkAlt: "Student writes an original answer while an AI-generated draft remains closed; image text says Common Awards and Write your own content.",
        artworkSrc: "/assets/policy-scenes/durham-own-work.jpg",
        evidenceHref: "#claim-claim-du-common-awards-no-substantive-ai"
      }
    ]
  },
  "university-of-auckland": {
    slug: "university-of-auckland",
    scopeDetail: "Lane 1 is controlled and may restrict or exclude AI; Lane 2 is non-controlled and permits AI without restriction under the new procedure. The retained Law page has a narrower written-permission rule. Ask your instructor to resolve conflicting task instructions during implementation.",
    sourceUpdate: { text: "Current procedure supplement, checked 30 Sep 2026: the Two-Lane procedure requires implementation by 2027. The snapshot and reviewed claims below preserve their earlier evidence; they do not yet reconcile this procedure with the Law School rule. Use the current procedure and ask your instructor about the applicable transition.", href: "https://www.auckland.ac.nz/en/about-us/about-the-university/policy-hub/education-student-experience/assessment/assessment-courses-procedures.html" },
    eyebrow: "Start with the assessment lane",
    title: "Two lanes: check the conditions of this task.",
    guidance: "",
    evidenceLabel: "Read the reviewed policy snapshot",
    evidenceHref: "#student-policy-heading",
    artworkAlt: "Student compares a controlled assessment station and an open study desk while reading the actual task instructions.",
    artworkSrc: "/assets/policy-scenes/auckland-mechanism-hero-v1.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    showGallerySummaries: true,
    quickGuide: {
      scopeNote: "Two-Lane implementation is required by 2027. Check how your current task is classified.",
      do: {
        artworkSrc: "/assets/policy-scenes/auckland-mechanism-do-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "Student asks an instructor about task instructions during the Two-Lane transition.",
        checks: [
          { text: "Find this assessment's lane.", evidenceHref: "https://www.auckland.ac.nz/en/about-us/about-the-university/policy-hub/education-student-experience/assessment/assessment-courses-procedures.html" },
          { text: "Check any narrower faculty rule.", evidenceHref: "https://www.auckland.ac.nz/en/law/current-students/llb-information/academic-information/student-use-of-ai.html" },
          { text: "Classify data before using an AI tool.", evidenceHref: "#snapshot-privacy_data" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/auckland-mechanism-dont-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "Student keeps a restricted-data folder out of an AI chat service.",
        checks: [
          { text: "Do not assume every Lane 1 task has the same AI restriction.", evidenceHref: "https://www.auckland.ac.nz/en/about-us/about-the-university/policy-hub/education-student-experience/assessment/assessment-courses-procedures.html" },
          { text: "Don't ignore the Law School's narrower rule.", evidenceHref: "https://www.auckland.ac.nz/en/law/current-students/llb-information/academic-information/student-use-of-ai.html" },
          { text: "Don't put restricted data in AI chat.", evidenceHref: "#snapshot-privacy_data" }
        ]
      }
    },
    storyCards: [
      {
        placement: "coursework",
        title: "Find the assessment lane",
        summary: "Lane 1 identifies controlled conditions and may restrict or exclude AI. Lane 2 identifies non-controlled tasks. Current procedures require implementation by 2027; confirm how this task is classified.",
        artworkAlt: "Student checks two assessment cards; image text says Two Lanes and Find your task's lane.",
        artworkSrc: "/assets/policy-scenes/auckland-lanes.jpg",
        evidenceHref: "https://www.auckland.ac.nz/en/about-us/about-the-university/policy-hub/education-student-experience/assessment/assessment-courses-procedures.html"
      },
      {
        placement: "disclosure",
        title: "Law School: written permission and disclosure",
        summary: "Auckland Law School prohibits AI-generated or AI-assisted content in graded work unless the instructor explicitly permits it in writing; permitted use must be disclosed.",
        artworkAlt: "Law student checks a written instructor instruction before drafting; image text says Law School and Written permission first.",
        artworkSrc: "/assets/policy-scenes/auckland-law.jpg",
        evidenceHref: "https://www.auckland.ac.nz/en/law/current-students/llb-information/academic-information/student-use-of-ai.html"
      },
      {
        placement: "privacy_data",
        title: "Keep restricted data out of AI chat",
        summary: "Auckland guidance says to assess data classification before using an AI tool and not to enter restricted data into AI chat services.",
        artworkAlt: "Student locks away a restricted-data folder beside a chat window; image text says Restricted Data and Keep it out of chat.",
        artworkSrc: "/assets/policy-scenes/auckland-privacy.jpg",
        evidenceHref: "#snapshot-privacy_data"
      },
    ]
  },
  "university-of-cambridge": {
    slug: "university-of-cambridge",
    studentFirst: true,
    eyebrow: "Student guide · Tripos and department rules",
    title: "Find the rule for your Tripos and college.",
    guidance: "Tripos and department guidelines govern Cambridge student assessments. Generative AI may be used for personal study and formative exploration, but unacknowledged AI in summative work is academic misconduct unless the assessment brief explicitly states otherwise.",
    evidenceLabel: "See what to do",
    evidenceHref: "#quick-guide",
    artworkAlt: "A student in a plain blue hoodie stands at a wooden library study desk holding an open blank booklet and reviewing course options.",
    artworkSrc: "/assets/policy-scenes/cambridge-mechanism-hero-v2.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    showGallerySummaries: true,
    scopeDetail: "Cambridge information-compliance guidance covers University staff administrative tasks only and excludes student academic assessments. Student coursework follows Tripos, department, and paper instructions; unacknowledged AI in summative submissions is academic misconduct unless explicitly permitted.",
    quickGuide: {
      scopeNote: "Check your Tripos, department, or paper assessment brief. Unacknowledged AI in summative work is academic misconduct unless explicitly permitted; acknowledgement does not override a local ban.",
      do: {
        artworkSrc: "/assets/policy-scenes/cambridge-mechanism-do-v3.jpg",
        artworkLandscape: true,
        artworkAlt: "DO: CHECK YOUR BRIEF / ACKNOWLEDGE PERMITTED USE comic: students check the course assessment brief and draft independent work.",
        checks: [
          { text: "Check your Tripos, department, or assignment assessment brief.", evidenceHref: "#snapshot-coursework" },
          { text: "Acknowledge permitted AI use in summative work when allowed.", evidenceHref: "#snapshot-disclosure" },
          { text: "Keep final assessed submissions your own independent work.", evidenceHref: "#snapshot-exams" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/cambridge-mechanism-dont-v3.jpg",
        artworkLandscape: true,
        artworkAlt: "DON'T: DON'T CLAIM AI AS YOUR OWN comic: student closes a laptop and writes original notes on a blank spiral notebook.",
        checks: [
          { text: "Don't submit unacknowledged AI content in summative work.", evidenceHref: "#snapshot-exams" },
          { text: "Don't assume acknowledgement overrides an assignment ban.", evidenceHref: "#snapshot-coursework" },
          { text: "Don't present AI-generated text or analysis as your own.", evidenceHref: "#snapshot-disclosure" }
        ]
      }
    }
  },
  "massachusetts-institute-of-technology": {
    slug: "massachusetts-institute-of-technology",
    studentFirst: true,
    eyebrow: "Student guide · Course rules and data risk",
    title: "Check course instructions and data classification.",
    guidance: "MIT coursework and exam rules are set by each course instructor. Under IS&T policy, low- and medium-risk data use MIT-licensed tools, while High Risk MIT data is strictly prohibited from all generative AI tools.",
    evidenceLabel: "See what to do",
    evidenceHref: "#quick-guide",
    artworkAlt: "A student in a plain blue hoodie stands at a studio workbench thoughtfully examining blank project folders to verify data risk.",
    artworkSrc: "/assets/policy-scenes/mit-mechanism-hero-v2.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    showGallerySummaries: true,
    scopeDetail: "IS&T data policy establishes that no generative AI tool is approved for High Risk MIT data. Academic and research disclosure is advised where AI contributes; enterprise tool availability never grants coursework or exam permission.",
    quickGuide: {
      scopeNote: "IS&T data policy: low and medium risk data use licensed tools; High Risk data is banned from all GenAI tools. Course instructors set problem-set and exam rules independently; tool access is not assignment permission.",
      do: {
        artworkSrc: "/assets/policy-scenes/mit-mechanism-do-v3.jpg",
        artworkLandscape: true,
        artworkAlt: "DO: CHECK DATA RISK / USE LICENSED TOOLS comic: student checks risk charts on an unbranded tablet and writes notes on a blank pad.",
        checks: [
          { text: "Check your course syllabus and instructor for problem-set rules.", evidenceHref: "https://ist.mit.edu/ai-guidance" },
          { text: "Disclose AI use in academic and research work where advised.", evidenceHref: "#snapshot-disclosure" },
          { text: "Use MIT-licensed tools for low- and medium-risk data.", evidenceHref: "#snapshot-approved_tools" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/mit-mechanism-dont-v3.jpg",
        artworkLandscape: true,
        artworkAlt: "DON'T: NO HIGH-RISK DATA IN AI comic: student locks an amber folder into a desk drawer and turns away from a blank computer monitor.",
        checks: [
          { text: "Don't put High Risk MIT information into any GenAI tool.", evidenceHref: "#snapshot-privacy_data" },
          { text: "Don't enter MIT research or educational data into unvetted public tools.", evidenceHref: "#snapshot-privacy_data" },
          { text: "Tool access on the IS&T list is not course or exam permission.", evidenceHref: "#snapshot-approved_tools" }
        ]
      }
    }
  },
  "university-of-exeter": {
    slug: "university-of-exeter",
    studentFirst: true,
    claimsOnly: true,
    snapshotNotice: noSnapshotNotice,
    eyebrow: "Student guide · Four-tier assessment model",
    title: "Check which tier applies to your assessment.",
    guidance: "From 2025–26, Exeter assessments follow a four-tier model: AI-integrated, AI-assisted, AI-minimal, and AI-prohibited. Check your assignment brief to see which tier applies before using any tool.",
    evidenceLabel: "See what to do",
    evidenceHref: "#quick-guide",
    artworkAlt: "CHECK FOUR TIERS / EXETER comic: student in a blue hoodie checks four assessment tiers at a university library study desk.",
    artworkSrc: "/assets/policy-scenes/exeter-mechanism-hero-v1.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    showGallerySummaries: true,
    scopeDetail: "Exeter's four assessment tiers govern student coursework and exams: AI-integrated, AI-assisted, AI-minimal (spelling and grammar only), and AI-prohibited. Postgraduate researchers must append a GenAI statement to upgrade portfolios and theses confirming if and how AI was used. Microsoft Copilot is available via IT Service Desk license requests.",
    quickGuide: {
      scopeNote: "Exeter uses a four-tier assessment model from 2025–26. In AI-minimal work, tools are limited to spelling and grammar; in AI-prohibited work, GenAI is entirely barred. Postgraduate researchers confirm if and how AI was used.",
      do: {
        artworkSrc: "/assets/policy-scenes/exeter-mechanism-do-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DO: RECORD PROMPTS & LINKS / INCLUDE IN REFERENCES comic: student logs prompts and hyperlinks in a reference list.",
        checks: [
          { text: "Check your assessment tier: AI-integrated, assisted, minimal, or prohibited.", evidenceHref: "#claim-claim-exeter-001" },
          { text: "For AI-integrated and AI-assisted tasks, record prompts and hyperlinks (where possible) in references.", evidenceHref: "#claim-claim-exeter-002" },
          { text: "PGRs: include a GenAI statement confirming if and how AI was used in thesis work.", evidenceHref: "#claim-claim-exeter-006" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/exeter-mechanism-dont-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DON'T: NO AI IN PROHIBITED TASKS / SPELLING & GRAMMAR ONLY IN MINIMAL comic: student stops AI use in prohibited assessments.",
        checks: [
          { text: "Don't use any GenAI tools in AI-prohibited assessments.", evidenceHref: "#claim-claim-exeter-003" },
          { text: "Don't exceed spelling and grammar checking in AI-minimal tasks.", evidenceHref: "#claim-claim-exeter-003" },
          { text: "In AI-integrated or assisted tasks, don't use unrecorded direct or indirect GenAI outputs.", evidenceHref: "#claim-claim-exeter-004" }
        ]
      }
    }
  },
  "keele-university": {
    slug: "keele-university",
    studentFirst: true,
    claimsOnly: true,
    snapshotNotice: noSnapshotNotice,
    eyebrow: "Student guide · Task brief and attribution",
    title: "Check task instructions and disclose all AI use.",
    guidance: "Keele requires students to follow task-specific instructions on whether AI is permitted. Where allowed, students must disclose AI tools and cite them properly; submitting unattributed AI or using AI where prohibited is academic misconduct.",
    evidenceLabel: "See what to do",
    evidenceHref: "#quick-guide",
    artworkAlt: "CHECK TASK BRIEF / KEELE comic: student in a blue hoodie reviews assessment instructions at a Keele study desk.",
    artworkSrc: "/assets/policy-scenes/keele-mechanism-hero-v1.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    showGallerySummaries: true,
    scopeDetail: "Keele's Student Academic Misconduct Code of Practice classifies inappropriate GenAI use in assessment as misconduct when work is presented without proper attribution or used where prohibited. Microsoft Copilot is provided under institutional Office 365 licensing; other tools require privacy and GDPR compliance.",
    quickGuide: {
      scopeNote: "Keele assessments require clear instructions on AI use. Disclose AI contributions and cite tools properly; submitting unattributed AI or using AI where explicitly prohibited is academic misconduct. Microsoft Copilot is the institutional tool.",
      do: {
        artworkSrc: "/assets/policy-scenes/keele-mechanism-do-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DO: DISCLOSE AI CONTRIBUTIONS / CITE PROPERLY IN WORK comic: student adds proper citation and disclosure for AI contributions in coursework.",
        checks: [
          { text: "Check your assessment instructions for clear rules on permitted AI use.", evidenceHref: "#claim-claim-keele-assessment-ai-disclosure-clarity" },
          { text: "Disclose when AI tools have been used and cite them properly in your work.", evidenceHref: "#claim-claim-keele-assessment-ai-disclosure-clarity" },
          { text: "Use institutional Microsoft Copilot provided with Keele Office 365 accounts.", evidenceHref: "#claim-cl-keele-university-microsoft-copilot-1041" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/keele-mechanism-dont-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DON'T: DON'T SUBMIT UNATTRIBUTED AI / NO AI WHERE PROHIBITED comic: student stops and puts away AI notes on prohibited assignments.",
        checks: [
          { text: "Don't submit AI-generated content as your own without proper attribution.", evidenceHref: "#claim-claim-keele-inappropriate-genai-academic-misconduct" },
          { text: "Don't use GenAI tools where they are explicitly prohibited in assessments.", evidenceHref: "#claim-claim-keele-inappropriate-genai-academic-misconduct" },
          { text: "Don't use unvetted external tools without considering data privacy and GDPR.", evidenceHref: "#claim-claim-keele-copilot-institutional-tool" }
        ]
      }
    }
  },
  "university-of-glasgow": {
    slug: "university-of-glasgow",
    studentFirst: true,
    claimsOnly: true,
    snapshotNotice: noSnapshotNotice,
    eyebrow: "Student guide · Regulation 32 and School rules",
    title: "Check Regulation 32 and your School's permitted AI level.",
    guidance: "Under Glasgow Regulation 32, using AI tools to generate answers or references is prohibited unless specifically permitted by your School. Where allowed, all AI inputs must be fully referenced; tool access with UofG credentials is not assessment permission.",
    evidenceLabel: "See what to do",
    evidenceHref: "#quick-guide",
    artworkAlt: "CHECK REGULATION 32 / GLASGOW comic: student in a blue hoodie checks University of Glasgow assessment regulations in a study hall.",
    artworkSrc: "/assets/policy-scenes/glasgow-mechanism-hero-v1.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    showGallerySummaries: true,
    scopeDetail: "Central Glasgow policy advises Schools to adopt one of three levels: AI not permitted, permitted under specified circumstances, or unrestricted with mandatory acknowledgement. Regulation 32 prohibits generating answers without authorization. Institutional Copilot access does not override assignment bans.",
    quickGuide: {
      scopeNote: "Regulation 32 bars software that generates answers or references unless your School assessment brief specifies otherwise. All AI inputs must be referenced. Having UofG Copilot access does not give assessment permission; keep sensitive data out of tools.",
      do: {
        artworkSrc: "/assets/policy-scenes/glasgow-mechanism-do-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DO: LOG IN TO COPILOT / CITE ALL AI INPUTS comic: student logs into institutional Copilot and references all AI inputs in an assignment.",
        checks: [
          { text: "Check your School's specific instructions and Regulation 32 rules.", evidenceHref: "#claim-claim-uog-reg32-ai-generated-answers" },
          { text: "Reference all AI inputs and computational aids in your submitted work.", evidenceHref: "#claim-claim-uog-student-ai-acknowledgement" },
          { text: "Exercise critical analysis and oversight over all generative AI outputs.", evidenceHref: "#claim-claim-uog-research-critical-oversight" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/glasgow-mechanism-dont-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DON'T: NO UNPERMITTED AI ANSWERS / KEEP WORK YOUR OWN comic: student turns away from AI generated answers to write independent coursework.",
        checks: [
          { text: "Don't use AI software that generates answers or references without School permission.", evidenceHref: "#claim-claim-uog-reg32-ai-generated-answers" },
          { text: "Don't assume institutional Copilot access grants assessment permission.", evidenceHref: "#claim-claim-uog-reg32-ai-generated-answers" },
          { text: "Don't put confidential, sensitive, or research data into AI tools.", evidenceHref: "#claim-claim-uog-sensitive-info-ai-tools" }
        ]
      }
    }
  },
  "tilburg-university": {
    slug: "tilburg-university",
    studentFirst: true,
    claimsOnly: true,
    snapshotNotice: noSnapshotNotice,
    eyebrow: "Student guide · TSHD rules and data privacy",
    title: "Verify all AI output and check faculty permission.",
    guidance: "Tilburg's Privacy & Security framework requires verifying all AI outputs for accuracy and bias. In the Tilburg School of Humanities and Digital Sciences (TSHD), AI is prohibited in exams and assignments unless explicitly permitted by your lecturer.",
    evidenceLabel: "See what to do",
    evidenceHref: "#quick-guide",
    artworkAlt: "CHECK TSHD PERMISSION / TILBURG comic: student in a blue hoodie examines faculty guidelines on a library study table.",
    artworkSrc: "/assets/policy-scenes/tilburg-mechanism-hero-v1.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    showGallerySummaries: true,
    scopeDetail: "Tilburg's reviewed policy includes faculty-specific rules for TSHD, where submitting unapproved AI work is fraud. Central privacy guidelines apply university-wide: personal data, confidential information, or commercially sensitive data should not be entered into GenAI tools unless the tool is assessed by an information manager first; accidental sharing must be reported promptly via the portal.",
    quickGuide: {
      scopeNote: "In TSHD, AI is not permitted in exams, tests, or assignments unless explicitly authorized by the lecturer. All GenAI outputs must be critically verified for errors and bias; personal and confidential data must not be entered into AI tools unless assessed by an information manager first.",
      do: {
        artworkSrc: "/assets/policy-scenes/tilburg-mechanism-do-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DO: VERIFY ALL OUTPUT / CHECK FACTS & BIAS comic: student critically reviews AI output for errors and bias.",
        checks: [
          { text: "Verify all GenAI output for errors, fabrications, and bias before use.", evidenceHref: "#claim-claim-tilburg-verify-output" },
          { text: "Check whether your TSHD lecturer has explicitly permitted AI for this task.", evidenceHref: "#claim-claim-tilburg-tshd-ai-permission" },
          { text: "Report accidental sharing of confidential or personal data promptly via the portal.", evidenceHref: "#claim-claim-tilburg-report-confidential-share" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/tilburg-mechanism-dont-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DON'T: NO SENSITIVE DATA IN AI / NO UNAPPROVED TSHD USE comic: student keeps sensitive data and unapproved AI out of exams.",
        checks: [
          { text: "Don't submit AI-generated content in TSHD assignments without permission.", evidenceHref: "#claim-claim-tilburg-tshd-ai-fraud" },
          { text: "Don't enter personal or confidential data unless the tool is assessed by an information manager first.", evidenceHref: "#claim-claim-tilburg-public-data-only" },
          { text: "Don't treat GenAI as a verified search engine or fact retrieval tool.", evidenceHref: "#claim-claim-tilburg-verify-output" }
        ]
      }
    }
  },
  "university-of-aberdeen": {
    slug: "university-of-aberdeen",
    studentFirst: true,
    claimsOnly: true,
    snapshotNotice: noSnapshotNotice,
    eyebrow: "Student guide · Course guidance and attribution",
    title: "Follow coordinator guidance and do your own critical thinking.",
    guidance: "Aberdeen Course Coordinators provide guidance on permitted AI use for each assessment. Students must do their own critical thinking and analysis; when AI use is permitted, tools, dates, and methods must be acknowledged, and unattributed AI is misconduct.",
    evidenceLabel: "See what to do",
    evidenceHref: "#quick-guide",
    artworkAlt: "DO YOUR OWN THINKING / ABERDEEN comic: student in a blue hoodie studies independently at an Aberdeen desk.",
    artworkSrc: "/assets/policy-scenes/aberdeen-mechanism-hero-v1.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    showGallerySummaries: true,
    scopeDetail: "Aberdeen policy requires Course Coordinators to set assessment permissions. Unattributed or unedited AI in submitted work is an academic integrity concern. Learning materials and assessment information must not be entered into GenAI tools without explicit permission from the author, and students should never enter personal and sensitive data.",
    quickGuide: {
      scopeNote: "Course Coordinators determine permitted AI use for assessments. Do your own critical analysis and thinking; when AI is permitted, acknowledge tools, timing, and methods. Course materials require author permission, and personal or sensitive data must never be entered.",
      do: {
        artworkSrc: "/assets/policy-scenes/aberdeen-mechanism-do-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DO: ACKNOWLEDGE TOOL & METHOD / NOTE WHEN AND HOW USED comic: student notes tool name, date, and method of AI use.",
        checks: [
          { text: "Check your Course Coordinator's guidance on permitted AI use.", evidenceHref: "#claim-claim-aberdeen-course-coordinators-guidance" },
          { text: "Acknowledge which tools were used, when, and how content was used.", evidenceHref: "#claim-claim-aberdeen-acknowledge-genai" },
          { text: "Ensure your critical thinking, analysis, and evaluation remain your own.", evidenceHref: "#claim-claim-aberdeen-student-no-critical-thinking" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/aberdeen-mechanism-dont-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DON'T: NO UNATTRIBUTED AI / NO PERSONAL OR SENSITIVE DATA comic: student avoids unattributed AI content and protects sensitive data.",
        checks: [
          { text: "Don't submit unattributed or unedited GenAI content in assessed work.", evidenceHref: "#claim-claim-aberdeen-genai-misconduct" },
          { text: "Don't use GenAI to replace your own critical thinking or essay writing.", evidenceHref: "#claim-claim-aberdeen-student-no-critical-thinking" },
          { text: "Don't enter course materials without author permission, and never enter personal or sensitive data.", evidenceHref: "#claim-claim-aberdeen-student-data-privacy" }
        ]
      }
    }
  },
  "flinders-university": {
    slug: "flinders-university",
    studentFirst: true,
    claimsOnly: true,
    snapshotNotice: noSnapshotNotice,
    eyebrow: "Student guide · Topic coordinator rules",
    title: "Get topic permission and follow task instructions.",
    guidance: "Flinders requires topic coordinator permission before using AI tools in assessments. The AI assessment scale is a staff template applied only when specified for your task; where permitted, AI use must be acknowledged.",
    evidenceLabel: "See what to do",
    evidenceHref: "#quick-guide",
    artworkAlt: "CHECK TOPIC SCALE / FLINDERS comic: student in a blue hoodie checks topic instructions and assessment scale options.",
    artworkSrc: "/assets/policy-scenes/flinders-mechanism-hero-v1.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    showGallerySummaries: true,
    scopeDetail: "Flinders policy defines AI misuse as using generative tools without topic coordinator permission and appropriate acknowledgement. The AI assessment scale provides staff with optional assignment tiers as a template; students follow the specific instructions assigned to their topic.",
    quickGuide: {
      scopeNote: "Using GenAI without topic coordinator permission and proper citation is academic misconduct. The assessment scale is a staff template used only when specified for your task; institutional Copilot access is not task permission.",
      do: {
        artworkSrc: "/assets/policy-scenes/flinders-mechanism-do-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DO: CITE PERMITTED AI / FOLLOW TOPIC SCALE comic: student cites permitted AI use following topic coordinator instructions.",
        checks: [
          { text: "Obtain permission from your topic coordinator before using AI in tasks.", evidenceHref: "#claim-cl-flinders-ai-misuse-integrity" },
          { text: "Follow the assessment scale tier if specifically assigned to your task.", evidenceHref: "#claim-cl-flinders-ai-assessment-scale" },
          { text: "Acknowledge and cite all permitted generative AI contributions.", evidenceHref: "#claim-cl-flinders-ai-misuse-integrity" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/flinders-mechanism-dont-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DON'T: NO AI WITHOUT PERMISSION / AVOID UNAPPROVED TOOLS comic: student closes unpermitted AI tools on an assessment.",
        checks: [
          { text: "Don't use ChatGPT, Gemini, or other AI tools without topic permission.", evidenceHref: "#claim-cl-flinders-ai-misuse-integrity" },
          { text: "Don't assume the staff assessment scale applies unless your task specifies it.", evidenceHref: "#claim-cl-flinders-ai-assessment-scale" },
          { text: "Don't treat institutional Copilot Chat access as automatic assessment approval.", evidenceHref: "#claim-cl-flinders-ai-misuse-integrity" }
        ]
      }
    }
  },
  "kingston-university-london": {
    slug: "kingston-university-london",
    studentFirst: true,
    claimsOnly: true,
    snapshotNotice: noSnapshotNotice,
    eyebrow: "Student guide · AR6 regulation and AG2 guidance",
    title: "Check your brief and acknowledge all AI contributions.",
    guidance: "Kingston's 2025/26 Academic Integrity regulations (AR6) define presenting AI content as your own without proper acknowledgement as misconduct unless explicitly permitted in the brief. AG2 requires acknowledging AI used for editorial assistance or proofreading.",
    evidenceLabel: "See what to do",
    evidenceHref: "#quick-guide",
    artworkAlt: "CHECK BRIEF & AR6 / KINGSTON comic: student in a blue hoodie checks assessment brief and Kingston AR6 guidelines.",
    artworkSrc: "/assets/policy-scenes/kingston-mechanism-hero-v1.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    showGallerySummaries: true,
    scopeDetail: "Kingston's 2025/26 regulations introduced formal GenAI definitions across AR6 (taught) and AR7 (research). Under AG2 guidance, students must acknowledge generative AI used as part of the editorial process.",
    quickGuide: {
      scopeNote: "Presenting AI content as your own without proper acknowledgement is prohibited under AR6 unless explicitly permitted by the brief. AG2 requires acknowledging generative AI used in the editorial process.",
      do: {
        artworkSrc: "/assets/policy-scenes/kingston-mechanism-do-v3.jpg",
        artworkLandscape: true,
        artworkAlt: "DO: ACKNOWLEDGE EDITORIAL AI / CHECK YOUR ASSESSMENT BRIEF comic: student reviews assessment brief and acknowledges editorial AI.",
        checks: [
          { text: "Check whether your assessment brief explicitly permits generative AI use.", evidenceHref: "#claim-claim-kingston-unacceptable-genai-ar6" },
          { text: "Properly acknowledge all AI tool contributions in submitted work.", evidenceHref: "#claim-claim-kingston-ai-acknowledgement-ar6" },
          { text: "Acknowledge generative AI used in the editorial process.", evidenceHref: "#claim-claim-kingston-gai-editorial-acknowledge-ag2" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/kingston-mechanism-dont-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DON'T: DON'T PRESENT AI AS YOURS / AVOID UNACKNOWLEDGED OUTPUT comic: student stops and removes unacknowledged AI content.",
        checks: [
          { text: "Don't present content generated by AI tools as your own without proper acknowledgement, except where explicitly permitted in the brief.", evidenceHref: "#claim-claim-kingston-unacceptable-genai-ar6" },
          { text: "Don't omit acknowledgement when using AI for editorial or proofreading help.", evidenceHref: "#claim-claim-kingston-gai-editorial-acknowledge-ag2" },
          { text: "Don't assume AI is permitted without an explicit assessment brief allowance.", evidenceHref: "#claim-claim-kingston-unacceptable-genai-ar6" }
        ]
      }
    }
  },
  "university-of-victoria-uvic": {
    slug: "university-of-victoria-uvic",
    studentFirst: true,
    claimsOnly: true,
    snapshotNotice: noSnapshotNotice,
    eyebrow: "Student guide · Practical instructions and systems policy",
    title: "Check course instructions and use protected tools.",
    guidance: "UVic has no general ban on generative AI tools in learning and teaching. As a practical first step, check your course instructions before using AI; DeepSeek is restricted on university networks and UVic-owned devices.",
    evidenceLabel: "See what to do",
    evidenceHref: "#quick-guide",
    artworkAlt: "CHECK COURSE OUTLINE / UVIC comic: student in a blue hoodie checks course outline instructions on a laptop.",
    artworkSrc: "/assets/policy-scenes/uvic-mechanism-hero-v1.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    showGallerySummaries: true,
    scopeDetail: "UVic's position statement embraces appropriate and ethical GenAI without a general ban on tools in learning and teaching. DeepSeek applications do not meet UVic security standards and are restricted on the UVic network (including campus wireless and VPN) and UVic-owned devices. UVic-managed Copilot Chat is available for Microsoft 365 accounts with enterprise data protection, and research guidance emphasizes transparency.",
    quickGuide: {
      scopeNote: "UVic has no general ban on GenAI; as a practical first step, check your course instructions. DeepSeek is restricted on UVic networks and UVic-owned devices. Use UVic-managed Copilot Chat with enterprise data protection.",
      do: {
        artworkSrc: "/assets/policy-scenes/uvic-mechanism-do-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DO: LOG IN TO CAMPUS COPILOT / PROTECT UNIVERSITY DATA comic: student signs into campus Copilot with enterprise protection.",
        checks: [
          { text: "As a practical first step, check your course instructions; the reviewed position states there is no general ban.", evidenceHref: "#claim-claim-uvic-teaching-genai-position" },
          { text: "Use UVic-managed Copilot Chat, available with a UVic Microsoft 365 account and enterprise data protection.", evidenceHref: "#claim-claim-uvic-copilot-chat-availability" },
          { text: "Researchers: maintain full transparency regarding the role of AI technologies in your work.", evidenceHref: "#claim-claim-uvic-research-genai-guidelines" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/uvic-mechanism-dont-v3.jpg",
        artworkLandscape: true,
        artworkAlt: "DON'T: NO DEEPSEEK ON UNIVERSITY SYSTEMS / PROTECT PRIVATE RESEARCH DATA comic: student in a blue hoodie closes unbranded laptop and keeps DeepSeek off university systems.",
        checks: [
          { text: "Don't access DeepSeek applications on the UVic network (including wireless/VPN) or UVic-owned devices.", evidenceHref: "#claim-claim-uvic-deepseek-restriction" },
          { text: "Don't enter highly confidential, confidential, or internal UVic Data into unapproved public GenAI tools.", evidenceHref: "#claim-claim-uvic-admin-approved-ai-tool" },
          { text: "Do not treat the absence of a general ban as permission for a particular assessed task.", evidenceHref: "#claim-claim-uvic-teaching-genai-position" }
        ]
      }
    }
  },
  "chalmers-university-of-technology": {
    slug: "chalmers-university-of-technology",
    studentFirst: true,
    claimsOnly: true,
    snapshotNotice: noSnapshotNotice,
    eyebrow: "Student guide · Course examiner rules and thesis ethics",
    title: "Ask your examiner and protect thesis materials.",
    guidance: "Course coordinators and examiners decide examination AI rules for each course at Chalmers. For thesis work, students must be transparent and consult supervisors on ethical uncertainties; never upload unpublished thesis text or sensitive data to chatbots.",
    evidenceLabel: "See what to do",
    evidenceHref: "#quick-guide",
    artworkAlt: "ASK COURSE EXAMINER / CHALMERS comic: student in a blue hoodie consults course examiner guidelines in a study library.",
    artworkSrc: "/assets/policy-scenes/chalmers-mechanism-hero-v1.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    showGallerySummaries: true,
    scopeDetail: "Chalmers Library guidance highlights that course examiners set rules for individual courses. Presenting AI text without citation is treated as plagiarism or ghostwriting. Uploading text intended for a thesis, dissertation, or publication to a chatbot risks copyright loss and data compromise.",
    quickGuide: {
      scopeNote: "Course examiners set examination AI rules individually. Thesis students must be fully transparent, cite tools, and consult supervisors; unpublished thesis drafts, sensitive data, and copyrighted PDFs must never be uploaded to chatbots.",
      do: {
        artworkSrc: "/assets/policy-scenes/chalmers-mechanism-do-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DO: DESCRIBE THESIS AI USE / BE FULLY TRANSPARENT comic: student documents and describes AI tool usage transparently.",
        checks: [
          { text: "Ask your course coordinator or examiner about AI rules at the start of each course.", evidenceHref: "#claim-cl-chalmers-course-ai-varies" },
          { text: "Describe what you did and cite the AI tools used with complete transparency.", evidenceHref: "#claim-cl-chalmers-ai-transparency" },
          { text: "Consult your Chalmers thesis supervisor before using AI if you have any uncertainties.", evidenceHref: "#claim-cl-chalmers-thesis-privacy-consult" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/chalmers-mechanism-dont-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DON'T: NO DRAFT THESIS UPLOADS / PROTECT SENSITIVE RESEARCH comic: student stops uploading unpublished thesis drafts to chatbots.",
        checks: [
          { text: "Don't upload draft thesis text, dissertations, or unpublished research to chatbots.", evidenceHref: "#claim-cl-chalmers-sensitive-copyright-ai" },
          { text: "Don't upload sensitive private data or copyright-protected library PDFs to AI tools.", evidenceHref: "#claim-cl-chalmers-sensitive-copyright-ai" },
          { text: "Don't claim AI-generated text or reasoning as your own independent work.", evidenceHref: "#claim-cl-chalmers-ai-transparency" }
        ]
      }
    }
  },
  "cardiff-university": {
    slug: "cardiff-university",
    studentFirst: true,
    claimsOnly: true,
    snapshotNotice: noSnapshotNotice,
    eyebrow: "Student guide · Module guidance and Academic Integrity",
    title: "Check module guidance before using AI in assessed work.",
    guidance: "Cardiff requires students to check module guidance before using AI tools for assessed work. Microsoft Copilot is suggested for exploratory literature research, and students develop responsible practice through the Academic Integrity module.",
    evidenceLabel: "See what to do",
    evidenceHref: "#quick-guide",
    artworkAlt: "CHECK MODULE GUIDANCE / CARDIFF comic: student in a blue hoodie checks Cardiff module guidance and regulations at a desk.",
    artworkSrc: "/assets/policy-scenes/cardiff-mechanism-hero-v1.jpg",
    artworkContainsText: true,
    artworkLandscape: true,
    storyLayout: "mechanisms",
    showGallerySummaries: true,
    scopeDetail: "Cardiff's published record sets expectations through the Academic Integrity framework and university academic regulations, which require communicated approaches to GenAI and clear definitions of misuse. Detailed local rules reside in module guidance and Learning Central modules.",
    quickGuide: {
      scopeNote: "Check module guidance before assessed AI use. The university encourages completing the Academic Integrity module. Copilot can assist with literature exploration, but module rules govern assessed tasks.",
      do: {
        artworkSrc: "/assets/policy-scenes/cardiff-mechanism-do-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DO: USE COPILOT TO EXPLORE / CHECK MODULE GUIDANCE comic: student uses Copilot for literature exploration and checks module guidance.",
        checks: [
          { text: "Check your module guidance before using any AI tool to support assessed work.", evidenceHref: "#claim-claim-cardiff-library-check-guidance-before-ai-assessed-work" },
          { text: "Use tools like Microsoft Copilot to explore topics and define research questions.", evidenceHref: "#claim-claim-cardiff-library-copilot-literature-searching" },
          { text: "Consider completing the Academic Integrity module on Learning Central to learn ethical AI practice.", evidenceHref: "#claim-claim-cardiff-academic-integrity-module-genai" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/cardiff-mechanism-dont-v1.jpg",
        artworkLandscape: true,
        artworkAlt: "DON'T: DON'T SKIP MODULE GUIDANCE / KEEP ACADEMIC INTEGRITY comic: student stops and checks module rules before using AI.",
        checks: [
          { text: "Don't use AI tools in assessed work without checking specific module guidance.", evidenceHref: "#claim-claim-cardiff-library-check-guidance-before-ai-assessed-work" },
          { text: "Don't bypass the University's Academic Integrity standards when using AI.", evidenceHref: "#claim-claim-cardiff-general-academic-integrity-framework" },
          { text: "Don't engage in misuse of Generative AI technologies as defined in regulations.", evidenceHref: "#claim-claim-cardiff-regulations-genai-approaches" }
        ]
      }
    }
  }
};

export interface PolicyScenePilotOptions {
  isPreview?: boolean;
}

const independentIllustrationBasis: Record<string, string> = {
  "stanford-university": "295468d92021e9c4d7c199c6ca7189eed2d5585a9d6e664772eb2220f3f3afd8",
  "university-of-cambridge": "8e076341a840db0b0da8005054ebd4314b95ab159de1b0e823775ea746289dcd",
  "massachusetts-institute-of-technology": "505b231ef5d9cd1b77fd98fff2deb52956c1c661e30b17ba077ffbe1dd12cc78"
};

const claimsOnlyIllustrationBasis: Record<string, string> = {
  "university-of-exeter": "f435575eb932f64011c212b331d9ecb63bbd284608dd4f9da48b16376aefc70c",
  "keele-university": "81dcc861884a8943fd8a77130d0afb02dfa167c4360452eb815b0687cdb8a750",
  "university-of-glasgow": "3863bf7ebae441a76fd3226152cbe84c8c863630da391e67c9d6b9d64b433b95",
  "tilburg-university": "75a4aabd0cb51dbb6241931de3244d2c29656634c1dbcd95406ada121d24b103",
  "university-of-aberdeen": "37428838ee3ff37b54efd90edfd7c9adc8380ce804adcba89a022679d689d5c9",
  "flinders-university": "511d10bd9e4d55cdb048257e725623004c87989bdd7448f0d8c184235c3fdce8",
  "kingston-university-london": "34e39084fbd985f6b3c1853e9ad6c7edf62dc9e8f1337509c2f0a2a441d88e76",
  "university-of-victoria-uvic": "27d9069295cce121c7bd4cc4106097ba146ec90746737f9b2af05cdcc9a7a343",
  "chalmers-university-of-technology": "201c5240f501e9f31c07aae5b6532098c40b0630fdc70e0fc77766834700472a",
  "cardiff-university": "2c77ee640fd790052a28a0564c3e8b32d0918ecb96a38ef8332f562fa8ef671a"
};

export function getPolicyScenePilot(
  slug: string,
  claims: PolicyClaim[],
  hasStrongSnapshot: boolean,
  hasClaimsSummary: boolean,
  _options?: PolicyScenePilotOptions
): PolicyScenePilot | undefined {
  // Published claims-only illustration gate for ten universities.
  if (Object.hasOwn(claimsOnlyIllustrationBasis, slug)) {
    if (hasStrongSnapshot) return undefined;
    if (reviewedClaimsFingerprint(claims) !== claimsOnlyIllustrationBasis[slug]) return undefined;
    const scene = scenes[slug as IllustratedPilotSlug];
    if (!scene?.claimsOnly) return undefined;
    return scene;
  }
  // Independent illustration pilot (Stanford, Cambridge, MIT): strong snapshot + fingerprint verified.
  if (Object.hasOwn(independentIllustrationBasis, slug)) {
    if (!hasStrongSnapshot || reviewedClaimsFingerprint(claims) !== independentIllustrationBasis[slug]) return undefined;
    return scenes[slug as IllustratedPilotSlug];
  }
  if (!isIndexRecoveryPilotSlug(slug)) return undefined;
  if (!hasCurrentIndexRecoveryBasis(slug, claims)) return undefined;
  const scene = scenes[slug];
  if (scene.claimsOnly || scene.snapshotNotice) {
    if (hasStrongSnapshot || !hasClaimsSummary) return undefined;
  } else if (!hasStrongSnapshot) {
    return undefined;
  }
  return scene;
}
