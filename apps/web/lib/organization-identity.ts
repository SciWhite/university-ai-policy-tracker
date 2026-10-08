export const organizationIdentity = {
  "@id": "https://eduaipolicy.org/#organization",
  "@type": "Organization",
  name: "University AI Policy Tracker",
  url: "https://eduaipolicy.org",
  foundingDate: "2026-05",
  email: "support@eduaipolicy.org",
  founder: { "@type": "Person", name: "Sam Song", sameAs: "https://www.linkedin.com/in/jiaxiang-s-021155378/" },
  sameAs: ["https://github.com/SciWhite/university-ai-policy-tracker", "https://www.linkedin.com/in/jiaxiang-s-021155378/"],
  description: "A Canadian public-interest EdTech initiative operated by an independent Canadian company on a non-commercial basis."
} as const;
