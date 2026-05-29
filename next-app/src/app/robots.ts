import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about", "/faq", "/how-it-works", "/apply", "/impressum", "/datenschutz"],
        disallow: ["/book", "/admin"],
      },
    ],
    sitemap: "https://example.com/sitemap.xml",
  };
}
