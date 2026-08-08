import { createSiteOgImage, siteOgImageSize } from "@/components/site-opengraph";

export const alt = "University AI Policy Tracker: from question to official source";
export const contentType = "image/png";
export const runtime = "edge";
export const size = siteOgImageSize;

export default function Image() {
  return createSiteOgImage("en");
}
