import Script from "next/script";

const themeInitScript = `
(() => {
  try {
    const stored = window.localStorage.getItem("uapt-theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.dataset.theme = stored;
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  } catch {
    document.documentElement.removeAttribute("data-theme");
  }
})();
`;

export function ThemeScript() {
  return (
    <Script
      dangerouslySetInnerHTML={{ __html: themeInitScript }}
      id="uapt-theme-init"
      strategy="beforeInteractive"
    />
  );
}
