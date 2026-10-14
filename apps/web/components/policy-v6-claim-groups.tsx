import {policyV6ScopeLabel} from "@/lib/policy-v6-evidence-labels";
import React from "react";
import type { SupportedLocale } from "@/lib/i18n";
import type { ClaimGroup } from "@/lib/university-claims-organization";
import { formatClaimGroupCount } from "@/lib/university-claims-organization";
import { translatePolicyReferenceUi as translate } from "@/lib/policy-reference-ui";
import { policyV6DensityCopy } from "@/lib/policy-v6-density-copy";
import { policyV6Copy } from "@/lib/policy-v6-copy";
import { ClaimEvidenceCard } from "./claim-evidence-card";
import { PolicyV6ActionIcon, PolicyV6Popover } from "./policy-v6-popover";

/** All claims and evidence remain server-rendered, once, with their original anchors. */
export function PolicyV6ClaimGroups({
  groups,
  entitySlug,
  locale,
  claimScopes,
}: {
  groups: ClaimGroup[];
  entitySlug: string;
  locale: SupportedLocale;
  claimScopes?: Record<string, string>;
}) {
  const ui = policyV6DensityCopy(locale);
  return (
    <div className="policy-v6-claimGroups">
      {groups.map((group) => (
        <PolicyV6Popover
          key={group.key}
          id={`claim-group-${group.key}`}
          label={
            <>
              <PolicyV6ActionIcon kind="document" />
              <span className="policy-v6-categoryText">
                <strong>{translate(group.title, locale)}</strong>
                <small>
                  {translate(
                    formatClaimGroupCount(group.claims.length),
                    locale,
                  )}
                </small>
              </span>
              <span className="policy-v6-categoryAction">
                {ui.viewClaims} ↗
              </span>
            </>
          }
          title={
            <>
              {translate(group.title, locale)}{" "}
              <small>
                {translate(formatClaimGroupCount(group.claims.length), locale)}
              </small>
            </>
          }
          closeLabel={policyV6Copy(locale).close}
          triggerClassName="policy-v6-categoryCard"
          className="policy-v6-claimPanel"
          width={1040}
          align="content"
        >
          <div className="policy-v6-claimGrid">
            {group.claims.map((claim) => (
              <ClaimEvidenceCard
                key={claim.id ?? claim.claimText}
                claim={claim}
                entitySlug={entitySlug}
                locale={locale}
                id={claim.id ? `claim-${claim.id}` : undefined}
                showConfidence={false}
                compact
                scopeNote={claim.id && claimScopes?.[claim.id] ? policyV6ScopeLabel(claimScopes[claim.id],locale) : undefined}
              />
            ))}
          </div>
        </PolicyV6Popover>
      ))}
    </div>
  );
}
