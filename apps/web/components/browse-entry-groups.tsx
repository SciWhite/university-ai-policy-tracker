import { DocumentLink as Link } from "@/components/document-link";
import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n";
import {
  rankingLandingSpecs,
  regionLandingSpecs,
  themeLandingSpecs
} from "@/lib/reference-pages";
import { translateSurfaceText } from "@/lib/surface-localization";

export interface BrowseEntryGroupsCopy {
  title: string;
  lead: string;
  themesTitle: string;
  regionsTitle: string;
  rankingsTitle: string;
  directoriesTitle: string;
}

interface BrowseEntryGroupsProps {
  copy: BrowseEntryGroupsCopy;
  locale?: SupportedLocale;
}

// Server-rendered entry points into the theme/region/ranking landing pages and
// the sources/tools directories. Group titles arrive pre-localized through page
// copy; landing-spec labels are localized here because this component renders
// below the surface-localization tree walk.
export function BrowseEntryGroups({
  copy,
  locale = DEFAULT_LOCALE
}: BrowseEntryGroupsProps) {
  const t = (value: string) => translateSurfaceText(value, locale);
  const groups = [
    {
      title: copy.themesTitle,
      links: themeLandingSpecs.map((spec) => ({
        href: `/themes/${spec.slug}`,
        label: t(spec.label)
      }))
    },
    {
      title: copy.regionsTitle,
      links: regionLandingSpecs.map((spec) => ({
        href: `/regions/${spec.slug}`,
        label: t(spec.label)
      }))
    },
    {
      title: copy.rankingsTitle,
      links: rankingLandingSpecs.map((spec) => ({
        href: `/rankings/${spec.slug}`,
        label: t(spec.label)
      }))
    },
    {
      title: copy.directoriesTitle,
      links: [
        { href: "/tools", label: t("AI tools") },
        { href: "/sources", label: t("Sources") }
      ]
    }
  ];

  return (
    <section aria-labelledby="browse-title" className="section compact-section" id="browse">
      <div className="section-heading">
        <h2 id="browse-title">{copy.title}</h2>
      </div>
      <p className="compact-note">{copy.lead}</p>
      <div className="entry-group-grid">
        {groups.map((group) => (
          <section className="entry-group" key={group.title}>
            <h3>{group.title}</h3>
            <ul>
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    data-analytics-event="nav_click"
                    data-analytics-nav-area="browse_entry"
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
