import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard/", "/my-account/"] },
    ],
    sitemap: "https://dropnfly.ph/sitemap.xml",
  };
}
