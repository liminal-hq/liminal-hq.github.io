const FALLBACK_SITE_URL = "https://liminalhq.ca";

export function getSiteUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;

  if (!siteUrl || siteUrl.trim().length === 0) {
    return FALLBACK_SITE_URL;
  }

  return siteUrl.replace(/\/$/, "");
}
