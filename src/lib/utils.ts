import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDashboardUrl(path: string = "") {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://dashboard.kobara.app";
  return `${dashboardUrl}${path}`;
}
