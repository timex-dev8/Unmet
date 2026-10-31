import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/app/idea/"], disallow: ["/app/", "/api/", "/welcome"] },
    sitemap: "https://unmet-ten.vercel.app/sitemap.xml",
  };
}
