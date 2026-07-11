import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PrivateAnalyticsDashboard } from "@/components/private-analytics-dashboard";
import {
  getAnalyticsDashboard,
  parseAnalyticsDashboardQuery
} from "@/lib/private-analytics-dashboard";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

const title = "Private analytics | University AI Policy Tracker";
const description =
  "Private growth, search visibility, acquisition, and onsite behavior analytics.";

export const dynamic = "force-dynamic";

interface PrivateAnalyticsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: { canonical: getAbsoluteSiteUrl("/internal/analytics") },
    description,
    robots: { follow: false, index: false },
    title
  };
}

export default async function PrivateAnalyticsPage({
  searchParams
}: PrivateAnalyticsPageProps = {}) {
  const resolvedParams = (await searchParams) ?? {};
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedParams)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value) {
      params.set(key, value);
    }
  }
  const query = parseAnalyticsDashboardQuery(params);
  const initialData = await getAnalyticsDashboard(query);
  const cookieStore = await cookies();
  const initialLocale =
    cookieStore.get("uapt-analytics-locale")?.value === "en" ? "en" : "zh";

  return (
    <PrivateAnalyticsDashboard
      initialData={initialData}
      initialLocale={initialLocale}
    />
  );
}
