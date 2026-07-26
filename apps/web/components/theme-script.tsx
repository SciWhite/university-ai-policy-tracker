const themeInitScript = `
(() => {
  const root = document.documentElement;
  try {
    const firstSegment = window.location.pathname.split("/").filter(Boolean)[0];
    root.lang = ["zh", "fr", "pl", "es", "nl", "ms"].includes(firstSegment)
      ? firstSegment
      : "en";
  } catch {
    root.lang = "en";
  }

  // data-theme is always resolved to "light" or "dark" before first paint, so
  // the stylesheet needs a single dark token block and no
  // prefers-color-scheme duplicate. A "system" preference is resolved here via
  // matchMedia and re-resolved when the OS theme changes.
  const readStored = () => {
    try {
      const value = window.localStorage.getItem("uapt-theme");
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  };
  try {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      root.dataset.theme = readStored() ?? (media.matches ? "dark" : "light");
    };
    apply();
    media.addEventListener("change", apply);
  } catch {
    root.dataset.theme = readStored() ?? "light";
  }
})();
`;

// Rendered as a raw inline script in <head> so the resolved theme applies
// before first paint; next/script's beforeInteractive queues behind the async
// runtime.
export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeInitScript }}
      id="uapt-theme-init"
    />
  );
}
