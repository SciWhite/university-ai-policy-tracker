import { translatePolicyReferenceUi } from "@/lib/policy-reference-ui";
import type { PolicyClaim } from "@uapt/shared";
import { ClaimEvidenceCard } from "@/components/claim-evidence-card";
import type { ClaimGroup } from "@/lib/university-claims-organization";
import { formatClaimGroupCount } from "@/lib/university-claims-organization";
import type { SupportedLocale } from "@/lib/i18n";
import { PolicySceneCard } from "@/components/policy-scene-story";
import type { PolicyScenePilot } from "@/lib/policy-scene-pilot";

interface UniversityClaimGroupsProps {
  entitySlug: string;
  groups: ClaimGroup[];
  locale: SupportedLocale;
  scene?: PolicyScenePilot;
  role?: "student" | "instructor" | "researcher" | "staff";
  collapsible?: boolean;
  localizeUi?: boolean;
}

/**
 * Renders reviewed claims grouped under semantic headings for the
 * index-recovery pilot. Claims render exactly once (no duplicated flat
 * list), evidence links, claim anchors (`#claim-...`), and analytics
 * attributes are preserved from ClaimEvidenceCard, and the group content is
 * server-rendered in the initial HTML without any click-to-load.
 */
export function UniversityClaimGroups({
  entitySlug,
  groups,
  locale,
  scene,
  role = "student",
  collapsible = false,
  localizeUi = false
}: UniversityClaimGroupsProps) {
  const t = (value: string) => localizeUi ? translatePolicyReferenceUi(value, locale) : value;
  return (
    <div className="claim-dimension-groups">
      {groups.map((group) => {
        const claimList = (
          <div className="claim-list">
            {group.claims.map((claim: PolicyClaim) => {
              const cards = scene?.storyCards?.filter(
                (card) => claim.id && card.evidenceHref === `#claim-${claim.id}`
              ) ?? [];
              return (
                <div className="claim-scene-pair" key={claim.id ?? claim.claimText}>
                  {cards.filter((card) => card.audience !== "research").map((card) => (
                    <PolicySceneCard card={card} evidenceLabel={scene?.evidenceLabel ?? "Read the evidence"} key={card.artworkSrc} />
                  ))}
                  <ClaimEvidenceCard
                    claim={claim}
                    entitySlug={entitySlug}
                    id={claim.id ? `claim-${claim.id}` : undefined}
                    locale={locale}
                  />
                  {cards.filter((card) => card.audience === "research").map((card) => (
                    <details className="policy-scene-research" key={card.artworkSrc} open={role === "researcher"}>
                      <summary>Research guidance</summary>
                      <PolicySceneCard card={card} evidenceLabel={scene?.evidenceLabel ?? "Read the evidence"} />
                    </details>
                  ))}
                </div>
              );
            })}
          </div>
        );
        return (
          <section
            aria-labelledby={`claim-group-${group.key}`}
            className="claim-dimension-group"
            data-claim-group={group.key}
            key={group.key}
          >
            {collapsible ? (
              <details className="claim-dimension-group__details">
                <summary id={`claim-group-${group.key}`}>
                  <span>{t(group.title)}</span>
                  <span className="claim-dimension-group__count">
                    {t(formatClaimGroupCount(group.claims.length))}
                  </span>
                  <span aria-hidden="true" className="claim-dimension-group__chevron">⌄</span>
                </summary>
                {claimList}
              </details>
            ) : (
              <>
                <h3 id={`claim-group-${group.key}`}>
                  {t(group.title)}
                  <span className="claim-dimension-group__count">
                    {t(formatClaimGroupCount(group.claims.length))}
                  </span>
                </h3>
                {claimList}
              </>
            )}
        </section>
        );
      })}
    </div>
  );
}
