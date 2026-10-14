import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Return the first image URL from a potentially comma-separated image string.
 * Supports single URLs or multi-image strings like "url1,url2,url3".
 */
export function getFirstImageUrl(imageStr?: string | null, fallback = "/placeholder.svg"): string {
  if (!imageStr) return fallback;
  const first = imageStr.split(",")[0]?.trim();
  return first || fallback;
}

/**
 * Return an array of all image URLs from a comma-separated image string.
 */
export function getAllImageUrls(imageStr?: string | null): string[] {
  if (!imageStr) return [];
  return imageStr.split(",").map((s) => s.trim()).filter(Boolean);
}

