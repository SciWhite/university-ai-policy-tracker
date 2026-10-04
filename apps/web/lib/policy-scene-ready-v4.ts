import type { PolicyScenePilot } from "./policy-scene-pilot";

// Authored guidance is pinned to the reviewed release, never refreshed from a live crawl.
export const readyV4IllustrationBasis = {
  "aalto-university": "cb361289659250b71282e551138eafc8ea1724c2cbf6063735016c3ef146cea4",
  "cornell-university": "9710147fb3239eba7d52c650fcdc458cf9025115ecae65c7b06173f31f34ad14",
  "university-of-melbourne": "73ff36d7913d4100540a3ac1dc0cffa331f06fcf01232ca436cdaa90999611fa"
} as const;

export type ReadyV4UniversitySlug = keyof typeof readyV4IllustrationBasis;

export const readyV4Scenes: Record<ReadyV4UniversitySlug, PolicyScenePilot> = {
  "aalto-university": {
    slug: "aalto-university", studentFirst: true,
    eyebrow: "Student guide · Course and task restrictions",
    title: "Check the instructions for this task.",
    guidance: "Aalto allows AI support for learning unless the course teacher instructs otherwise. Check restrictions for this course and task, mark AI-generated content, and follow the data rules for the service you use.",
    scopeDetail: "Course teachers may restrict AI for particular learning tasks. Marking generated content does not override those restrictions. Aalto AI Assistant permits public, internal and confidential data, but excludes secret and sensitive personal data; that distinction is specific to the service. The snapshot below does not establish exam permission.",
    evidenceLabel: "See what to do", evidenceHref: "#quick-guide",
    artworkSrc: "/assets/policy-scenes/aalto-mechanism-hero-v1.jpg",
    artworkAlt: "CHECK THIS TASK: a student and course teacher compare the instructions for the current learning task at a studio workbench.",
    artworkContainsText: true, artworkLandscape: true,
    quickGuide: {
      scopeNote: "Course and task instructions control learning use. Data limits below refer specifically to Aalto AI Assistant.",
      do: {
        artworkSrc: "/assets/policy-scenes/aalto-mechanism-do-v1.jpg", artworkLandscape: true,
        artworkAlt: "DO, MARK AI CONTENT: a student adds an attribution note beside generated material in a coursework draft.",
        checks: [
          { text: "Read the teacher's restrictions for this course and learning task.", evidenceHref: "#snapshot-coursework" },
          { text: "If permitted, mark generated content and identify the tool and required details.", evidenceHref: "#snapshot-disclosure" },
          { text: "Check the data classification before using Aalto AI Assistant.", evidenceHref: "#snapshot-privacy_data" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/aalto-mechanism-dont-v1.jpg", artworkLandscape: true,
        artworkAlt: "DON'T, NO SECRET DATA: a student keeps a secret-data folder away from a laptop; this panel concerns Aalto AI Assistant's data limits.",
        checks: [
          { text: "Don't use AI against the teacher's course or task instructions.", evidenceHref: "#snapshot-coursework" },
          { text: "Don't present generated content as your own written response.", evidenceHref: "#snapshot-disclosure" },
          { text: "Don't enter secret or sensitive personal data into Aalto AI Assistant.", evidenceHref: "#snapshot-privacy_data" }
        ]
      }
    }
  },
  "cornell-university": {
    slug: "cornell-university", studentFirst: true,
    eyebrow: "Student guide · Instructor and assignment choices",
    title: "Find the policy for your course and assignment.",
    guidance: "Cornell gives instructors room to set different AI policies. Read this course's syllabus and assignment instructions; when use is permitted, follow its attribution requirements and verify the output.",
    scopeDetail: "Cornell's example syllabus language illustrates choices instructors can adopt; it is not one policy for every course. Attribution applies to permitted use and does not override a ban. IT restrictions on sensitive Cornell information apply to public AI tools. Listed tools do not establish assessment permission, and the snapshot has no exam-specific rule.",
    evidenceLabel: "See what to do", evidenceHref: "#quick-guide",
    artworkSrc: "/assets/policy-scenes/cornell-mechanism-hero-v1.jpg",
    artworkAlt: "FIND YOUR COURSE POLICY: an instructor points a student to the current assignment's policy card among several alternatives.",
    artworkContainsText: true, artworkLandscape: true,
    quickGuide: {
      scopeNote: "Instructor choices and sample policies are course or assignment scoped. Attribution is conditional on permission.",
      do: {
        artworkSrc: "/assets/policy-scenes/cornell-mechanism-do-v1.jpg", artworkLandscape: true,
        artworkAlt: "DO, ATTRIBUTE PERMITTED USE: a student connects an attribution note to a draft while checking the course instructions.",
        checks: [
          { text: "Check the course syllabus and this assignment's AI instructions.", evidenceHref: "#snapshot-coursework" },
          { text: "Document and attribute permitted use as the course requires.", evidenceHref: "#snapshot-disclosure" },
          { text: "Verify generated information and references before submitting your work.", evidenceHref: "#claim-claim-cornell-university-6" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/cornell-mechanism-dont-v1.jpg", artworkLandscape: true,
        artworkAlt: "DON'T, UPLOAD RESTRICTED DATA: a student keeps a restricted Cornell-information folder away from a public-facing computer.",
        checks: [
          { text: "Don't treat sample syllabus policies as permission for every course.", evidenceHref: "#snapshot-coursework" },
          { text: "Don't omit required attribution for quoted generated content.", evidenceHref: "#snapshot-disclosure" },
          { text: "Don't put confidential, regulated or restricted Cornell information in public AI tools.", evidenceHref: "#snapshot-privacy_data" }
        ]
      }
    }
  },
  "university-of-melbourne": {
    slug: "university-of-melbourne", studentFirst: true,
    eyebrow: "Student guide · Subject Coordinator authorisation",
    title: "Check your subject before assessment use.",
    guidance: "Before using GenAI for assessment-related work, check that your Subject Coordinator has authorised it. Learning support and another subject's rules do not establish permission for this assessment.",
    scopeDetail: "The illustrated guide concerns subject-level assessment authorisation. The reviewed snapshot below retains earlier citation, privacy and tool evidence; those topics have not all been reverified during this layout update. A listed University tool is not assessment permission. Check the current official guidance and your subject instructions.",
    sourceUpdate: {
      text: "Source check, 3 Oct 2026: the student guide now redirects to a new address and still requires Subject Coordinator authorisation before assessment-related GenAI use. The older reviewed record below retains privacy, citation and tool evidence. Its older privacy section was not found in the moved student guide, and the teaching source could not be reverified in this check; treat those sections as dated evidence and confirm current requirements.",
      href: "https://students.unimelb.edu.au/academic-skills/study-skills/learning-with-genai/GenAI-at-Melbourne"
    },
    evidenceLabel: "See what to do", evidenceHref: "#quick-guide",
    artworkSrc: "/assets/policy-scenes/melbourne-mechanism-hero-v1.jpg",
    artworkAlt: "CHECK YOUR SUBJECT: a student brings the current subject's assessment brief to the Subject Coordinator.",
    artworkContainsText: true, artworkLandscape: true,
    quickGuide: {
      scopeNote: "Check Subject Coordinator authorisation for the assessment-related work you intend to do. Other subjects and tool access do not grant it.",
      do: {
        artworkSrc: "/assets/policy-scenes/melbourne-mechanism-do-v1.jpg", artworkLandscape: true,
        artworkAlt: "DO, ASK BEFORE ASSESSMENT: a student discusses the assessment task with the coordinator before opening a laptop.",
        checks: [
          { text: "Check that your Subject Coordinator has authorised this assessment use.", evidenceHref: "#claim-claim-university-of-melbourne-1" },
          { text: "Read the AI boundaries set for this subject.", evidenceHref: "#snapshot-coursework" },
          { text: "Produce the assessed skills and work yourself; learning support is not a substitute.", evidenceHref: "#claim-claim-university-of-melbourne-4" }
        ]
      },
      dont: {
        artworkSrc: "/assets/policy-scenes/melbourne-mechanism-dont-v1.jpg", artworkLandscape: true,
        artworkAlt: "DON'T, ASSUME PERMISSION: a student sets aside an unrelated subject booklet and checks the current assessment brief.",
        checks: [
          { text: "Don't assume another subject's rules apply to this subject.", evidenceHref: "#snapshot-coursework" },
          { text: "Don't treat general learning support as authorisation for assessment work.", evidenceHref: "#claim-claim-university-of-melbourne-1" },
          { text: "Don't replace the skills being assessed with generated output.", evidenceHref: "#claim-claim-university-of-melbourne-4" }
        ]
      }
    }
  }
};
