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

// Rendered as a raw inline script in <head> so the stored theme applies before
// first paint; next/script's beforeInteractive queues behind the async runtime.
export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeInitScript }}
      id="uapt-theme-init"
    />
  );
}
