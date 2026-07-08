import type { MetadataRoute } from "next";
import { getShardCount } from "@/lib/sitemap-shards";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const shardCount = await getShardCount();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account/", "/admin/", "/auth/", "/debug/"],
    },
    sitemap: Array.from(
      { length: shardCount },
      (_, id) => `${SITE_URL}/sitemap/${id}.xml`
    ),
  };
}
