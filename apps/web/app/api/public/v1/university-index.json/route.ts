import { getStaticUniversityIndexRecords } from "@/lib/university-index-records";

export const dynamic = "force-static";

export async function GET() {
  const records = await getStaticUniversityIndexRecords();

  return Response.json({
    data: {
      records
    },
    meta: {
      generatedAt: new Date().toISOString(),
      recordCount: records.length
    }
  });
}
