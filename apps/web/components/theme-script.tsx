import Script from "next/script";

const themeInitScript = `
(() => {
  try {
    const firstSegment = window.location.pathname.split("/").filter(Boolean)[0];
    document.documentElement.lang = ["zh", "fr", "pl", "es", "nl", "ms"].includes(firstSegment)
      ? firstSegment
      : "en";

    const stored = window.localStorage.getItem("uapt-theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.dataset.theme = stored;
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  } catch {
    document.documentElement.lang = "en";
    document.documentElement.removeAttribute("data-theme");
  }
})();
`;

export function ThemeScript() {
  return (
    <Script id="uapt-theme-init" strategy="beforeInteractive">
      {themeInitScript}
    </Script>
  );
}
