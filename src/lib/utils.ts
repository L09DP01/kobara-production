import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDashboardUrl(path: string = "") {
  const dashboardUrl = (process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://dashboard.kobara.app").replace(/\/+$/, "");
  const normalizedPath = path && !path.startsWith("/") ? `/${path}` : path;
  if (normalizedPath && dashboardUrl.endsWith(normalizedPath)) return dashboardUrl;
  return `${dashboardUrl}${normalizedPath}`;
}
