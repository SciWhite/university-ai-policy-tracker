import {
  getStaticUniversityIndexRecords,
  universityIndexRankingSystems
} from "@/lib/university-index-records";
import { UniversitiesIndexClient } from "./universities-index-client";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata = {
  title: "Universities | University AI Policy Tracker"
};

export default async function UniversitiesPage() {
  const records = await getStaticUniversityIndexRecords();

  return (
    <UniversitiesIndexClient
      records={records}
      rankingSystems={universityIndexRankingSystems}
    />
  );
}
