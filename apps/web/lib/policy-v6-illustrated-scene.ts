import type {
  PolicyScenePilot,
  PolicySceneQuickCheck,
} from "./policy-scene-pilot";
import type { LabSchool } from "./policy-v6";
import type { SupportedLocale } from "./i18n";
import { translatePolicyReferenceUi } from "./policy-reference-ui";
import artPins from "./policy-v6-illustration-pins.json";

/** Separate V6 art acceptance against the newly published claim basis; historical V4 gates stay unchanged. */
export function getPolicyV6IllustratedScene(
  school: LabSchool,
  locale: SupportedLocale,
): PolicyScenePilot | undefined {
  if (
    school.slug === "harvard-university" &&
    !school.revision.startsWith("local-agent-v6-")
  )
    return undefined;
  const pin = (
    artPins as Record<
      string,
      {
        fingerprint: string;
        hero: string;
        do: string;
        dont: string;
        square?: boolean;
      }
    >
  )[school.slug];
  if (!pin || pin.fingerprint !== school.fingerprint) return undefined;
  const zh = locale === "zh";
  const specific: Record<string, { title: string; scope: string }> = {
    "harvard-university": {
      title: zh
        ? "按本学院、课程和任务的规则使用 AI。"
        : "Follow your School, course and task rules.",
      scope: zh
        ? "HGSE、Social Studies、HLS Graduate Program 和 HMS 各有范围。获准学习用途不等于可提交生成内容；工具资格和数据等级须分别核对。"
        : "HGSE, Social Studies, the HLS Graduate Program and HMS have distinct scopes. Permitted learning use does not mean generated submissions are allowed; check tool eligibility and data limits separately.",
    },
    "university-of-cambridge": {
      title: zh
        ? "先查 Tripos、课程及这项评估的说明。"
        : "Check your Tripos, course and assessment brief.",
      scope: zh
        ? "个人学习、formative work 与 summative assessment 分开判断。Engineering Triposes 有额外规则；员工行政指导不适用于学生学习、评估或科研。"
        : "Distinguish personal study and formative work from summative assessment. Engineering Triposes have additional rules; staff administrative guidance excludes student learning, assessment and research.",
    },
    "stanford-university": {
      title: zh
        ? "先找对学院与这项作业的规则。"
        : "Find the rule for your school and assignment.",
      scope: zh
        ? "图中的 PWR 写作限制只适用于 PWR。GSB MBA/MSx、Law、MD/MSPA 有不同规则；请分别阅读下方对应证据。"
        : "The PWR writing restriction in this illustration applies to PWR only. GSB MBA/MSx, Law and MD/MSPA have different rules; read the relevant evidence below.",
    },
    "imperial-college-london": {
      title: zh
        ? "工具访问和任务许可，分开核对。"
        : "Check tool access and task permission separately.",
      scope: zh
        ? "按所在部门及具体评估的说明判断 AI 使用；机构工具的访问权限不替代作业规则。"
        : "Read your department and assessment instructions. Institutional tool access does not replace the assignment rule.",
    },
    "massachusetts-institute-of-technology": {
      title: zh
        ? "核对课程要求，再核对数据风险。"
        : "Check the course rule and the data risk.",
      scope: zh
        ? "课程和评估要求须单独核对。IS&T 指导禁止将 High Risk MIT 数据用于任何 GenAI 工具；机构工具访问不授予评估许可。"
        : "Check course and assessment requirements separately. IS&T guidance prohibits High Risk MIT data in any GenAI tool; institutional access is not assessment permission.",
    },
    "university-of-oxford": {
      title: zh
        ? "读这项评估的说明，确认所属范围。"
        : "Read this assessment’s instructions and scope.",
      scope: zh
        ? "图中的研究生写作情境限于相关 MPLS 规则，不代表牛津所有学院。评估声明、研究披露和数据条件须按各自来源阅读。"
        : "The postgraduate writing scene refers to the relevant MPLS rules, not every Oxford division. Assessment declarations, research disclosure and data conditions have their own source scopes.",
    },
  };
  const copy = specific[school.slug];
  if (!copy) return undefined;
  const action = (text: string, key: string): PolicySceneQuickCheck => ({
    text,
    evidenceHref: `#snapshot-${key}`,
  });
  const doChecks = [
    action(
      zh
        ? "查看本学院、课程和具体作业的要求。"
        : "Read your school, course and assignment instructions.",
      "coursework",
    ),
    action(
      zh
        ? "按适用规则记录获准的 AI 使用。"
        : "Document permitted AI use under the applicable rules.",
      "disclosure",
    ),
    action(
      zh
        ? "核对资料分类及机构工具的使用条件。"
        : "Check data classification and institutional tool conditions.",
      "privacy_data",
    ),
  ] as [
    ReturnType<typeof action>,
    ReturnType<typeof action>,
    ReturnType<typeof action>,
  ];
  const dontChecks = [
    action(
      zh
        ? "不要把工具可访问当作评估使用许可。"
        : "Do not treat tool access as assessment permission.",
      "approved_tools",
    ),
    action(
      zh
        ? "不要违反这项任务适用的 AI 限制。"
        : "Do not exceed this task’s AI restrictions.",
      "exams",
    ),
    action(
      zh
        ? "不要将敏感资料交给未获相应批准的工具。"
        : "Do not put sensitive data in tools not approved for that data.",
      "privacy_data",
    ),
  ] as typeof doChecks;
  return {
    slug: school.slug as PolicyScenePilot["slug"],
    eyebrow: translatePolicyReferenceUi("Student guide", locale),
    title: copy.title,
    guidance: copy.scope,
    evidenceLabel: translatePolicyReferenceUi("View evidence", locale),
    evidenceHref: "#student-policy-heading",
    artworkSrc: pin.hero,
    artworkAlt: copy.scope,
    artworkContainsText: true,
    artworkSquare: pin.square,
    artworkLandscape: !pin.square,
    claimsOnly: true,
    studentFirst: true,
    showGallerySummaries: true,
    quickGuide: {
      scopeNote: copy.scope,
      do: {
        artworkSrc: pin.do,
        artworkLandscape: !pin.square,
        artworkAlt:
          "Student checks applicable instructions and documents permitted use.",
        checks: doChecks,
      },
      dont: {
        artworkSrc: pin.dont,
        artworkLandscape: !pin.square,
        artworkAlt: copy.scope,
        checks: dontChecks,
      },
    },
  };
}
