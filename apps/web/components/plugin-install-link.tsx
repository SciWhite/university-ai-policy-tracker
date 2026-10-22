import { UNIVERSITY_POLICY_PLUGIN_URL } from "@/lib/plugin-directory";
export function PluginInstallLink({ labels }: { labels: readonly string[] }) {
 return <a href={UNIVERSITY_POLICY_PLUGIN_URL} className="button" target="_blank" rel="noopener noreferrer">{labels[10]} ↗</a>;
}
