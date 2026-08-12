export function truncateTitle(title: string | undefined | null, maxLength = 38): string {
  if (!title) return "";
  return title.length > maxLength
    ? title.substring(0, maxLength) + "..."
    : title;
}

