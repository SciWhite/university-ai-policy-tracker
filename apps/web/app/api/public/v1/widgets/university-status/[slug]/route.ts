import { NextResponse } from "next/server";
import { getCatalogUniversities } from "@/lib/catalog";
import {
  getUniversityStatusWidget,
  widgetCorsHeaders
} from "@/lib/developer-surfaces";

export const dynamic = "force-static";
export const dynamicParams = false;

interface WidgetStatusRouteProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  return (await getCatalogUniversities()).flatMap((university) => [
    { slug: university.slug },
    { slug: `${university.slug}.json` }
  ]);
}

export async function GET(_request: Request, { params }: WidgetStatusRouteProps) {
  const { slug } = await params;
  const universitySlug = slug.endsWith(".json")
    ? slug.slice(0, -".json".length)
    : slug;
  const widget = await getUniversityStatusWidget(universitySlug);

  if (!widget) {
    return NextResponse.json(
      { error: `University not found: ${universitySlug}` },
      { headers: widgetCorsHeaders, status: 404 }
    );
  }

  return NextResponse.json(widget, { headers: widgetCorsHeaders });
}

export function OPTIONS() {
  return new Response(null, { headers: widgetCorsHeaders });
}
