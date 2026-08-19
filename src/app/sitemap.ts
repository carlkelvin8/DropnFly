import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://dropnfly.ph", lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: "https://dropnfly.ph/book", lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: "https://dropnfly.ph/track", lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: "https://dropnfly.ph/my-account/login", lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];
}
