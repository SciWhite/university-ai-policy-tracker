interface ReferenceTab {
  href: `#${string}`;
  label: string;
}

interface ReferenceTabsProps {
  tabs: readonly ReferenceTab[];
}

export function ReferenceTabs({ tabs }: ReferenceTabsProps) {
  return (
    <nav aria-label="Record sections" className="reference-tabs">
      {tabs.map((tab) => (
        <a href={tab.href} key={tab.href}>
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
