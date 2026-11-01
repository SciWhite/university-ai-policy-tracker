import React from "react";
import type { SupportedLocale } from "@/lib/i18n";
import { policyV6DensityCopy } from "@/lib/policy-v6-density-copy";
import { translatePolicyReferenceUi } from "@/lib/policy-reference-ui";

export function PolicyV6HeaderLocation({
  region,
  country,
  checkedAt,
  changedAt,
  locale,
  sharedUiText = {},
}: {
  region: string;
  country: string;
  checkedAt?: string;
  changedAt?: string;
  locale: SupportedLocale;
  sharedUiText?: Readonly<Record<string, string>>;
}) {
  const date = checkedAt ?? changedAt;
  return (
    <span className="policy-v6-headerLocation">
      <span data-i18n="preserve">{region}, {country}</span>{" "}
      {date ? (
        <span className="policy-v6-headerDate">
          {checkedAt
            ? sharedUiText["Last checked"] ?? policyV6DensityCopy(locale).checked
            : translatePolicyReferenceUi("Updated", locale)}{" "}
          <time dateTime={date}>
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeZone: "UTC",
            }).format(new Date(date))}
          </time>
        </span>
      ) : null}
    </span>
  );
}
