import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// The product is a single-page app: only the public landing page is indexable.
// Signed-in views live behind authentication and are not listed.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 }];
}
