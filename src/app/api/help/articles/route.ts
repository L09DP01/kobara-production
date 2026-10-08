import { NextRequest, NextResponse } from "next/server";
import { publishedHelpArticles } from "@/lib/help-center-content";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path")?.replace(/^\/+|\/+$/g, "");
  const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase();
  let articles = publishedHelpArticles;
  if (path) articles = articles.filter((item) => item.path === path);
  if (query) articles = articles.filter((item) => `${item.title} ${item.description} ${item.keywords.join(" ")}`.toLowerCase().includes(query));

  return NextResponse.json({ version: "1.0", locale: "fr-HT", generatedAt: new Date().toISOString(), count: articles.length, articles }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } });
}
