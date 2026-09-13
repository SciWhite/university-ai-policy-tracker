import type { PolicyClaim } from "@uapt/shared";
import { ClaimEvidenceCard } from "@/components/claim-evidence-card";
import type { ClaimGroup } from "@/lib/university-claims-organization";
import { formatClaimGroupCount } from "@/lib/university-claims-organization";
import type { SupportedLocale } from "@/lib/i18n";

interface UniversityClaimGroupsProps {
  entitySlug: string;
  groups: ClaimGroup[];
  locale: SupportedLocale;
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
  locale
}: UniversityClaimGroupsProps) {
  return (
    <div className="claim-dimension-groups">
      {groups.map((group) => (
        <section
          aria-labelledby={`claim-group-${group.key}`}
          className="claim-dimension-group"
          data-claim-group={group.key}
          key={group.key}
        >
          <h3 id={`claim-group-${group.key}`}>
            {group.title}
            <span className="claim-dimension-group__count">
              {formatClaimGroupCount(group.claims.length)}
            </span>
          </h3>
          <div className="claim-list">
            {group.claims.map((claim: PolicyClaim) => (
              <ClaimEvidenceCard
                claim={claim}
                entitySlug={entitySlug}
                id={claim.id ? `claim-${claim.id}` : undefined}
                key={claim.id ?? claim.claimText}
                locale={locale}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
