import type { MetadataRoute } from "next";

/**
 * robots.txt (§20 SEO).
 * Allow all crawlers, point to sitemap. Private/app routes are protected
 * by Clerk auth (proxy.ts) so they aren't crawlable anyway.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/sign-in", "/sign-up", "/dashboard", "/admin/"],
      },
    ],
    sitemap: "https://danael.app/sitemap.xml",
    host: "https://danael.app",
  };
}
