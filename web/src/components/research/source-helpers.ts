import type { SourceMaterial } from "@/hooks/use-sources";

/**
 * Shared helper functions for source badge display, email abbreviation,
 * and relative time formatting. Used by both Source Manager and Content Manager.
 */

export function getSourceBadge(
  source: SourceMaterial,
  emailByConnectionId: Map<string, string>,
): string {
  if (source.sourceType === "local") return "Device";
  if (!source.driveConnectionId) return "Account disconnected";
  const email = emailByConnectionId.get(source.driveConnectionId);
  if (!email) return "Account disconnected";
  const singleAccount = emailByConnectionId.size <= 1;
  return abbreviateEmail(email, singleAccount);
}

export function abbreviateEmail(email: string, singleAccount: boolean): string {
  if (singleAccount) return "Drive";
  const [local] = email.split("@");
  if (!local) return email;
  return local.length > 14 ? local.slice(0, 12) + "..." : local;
}

export function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never synced";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
