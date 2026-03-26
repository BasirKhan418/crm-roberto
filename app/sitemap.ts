import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/login",
    "/signup",
    "/forgot-password",
    "/onboarding",
    "/dashboard",
    "/clients",
    "/suppliers",
    "/notes",
    "/profile",
  ];

  const now = new Date();

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "/dashboard" ? "daily" : "weekly",
    priority: route === "" ? 1 : route === "/dashboard" ? 0.9 : 0.7,
  }));
}
