import { ImageResponse } from "next/og";
import { getMonthlyReportShareImage } from "@/lib/monthly-report-registry";

export const alt = "University AI Policy Tracker monthly report share image";
export const contentType = "image/png";
export const runtime = "edge";
export const size = {
  height: 630,
  width: 1200
};

export default async function Image({
  params
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  const shareImage = getMonthlyReportShareImage(month);

  return new ImageResponse(
    (
      <div
        style={{
          background: "#f6f8fa",
          border: "1px solid #d0d7de",
          color: "#24292f",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: 64,
          width: "100%"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              color: "#57606a",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 0,
              textTransform: "uppercase"
            }}
          >
            University AI Policy Tracker
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: 0,
              lineHeight: 1.04,
              maxWidth: 940
            }}
          >
            {shareImage?.headline ?? "Monthly Report"}
          </div>
          <div
            style={{
              color: "#57606a",
              fontSize: 32,
              lineHeight: 1.35,
              maxWidth: 980
            }}
          >
            Evidence-backed university AI policy records, source URLs, review
            states, change logs, and all-university GEO coverage.
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 20,
            justifyContent: "space-between"
          }}
        >
          <div style={{ color: "#57606a", fontSize: 28 }}>
            eduaipolicy.org/reports/monthly/{month}
          </div>
          <div
            style={{
              background: "#0969da",
              borderRadius: 8,
              color: "#ffffff",
              fontSize: 28,
              fontWeight: 700,
              padding: "14px 20px"
            }}
          >
            Public monthly report
          </div>
        </div>
      </div>
    ),
    size
  );
}
