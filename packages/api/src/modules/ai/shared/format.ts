export function truncateText(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > maxLength
    ? `${trimmed.slice(0, maxLength - 1).trimEnd()}…`
    : trimmed;
}

export function toNullableString(
  value: unknown,
  maxLength?: number,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return maxLength ? truncateText(trimmed, maxLength) : trimmed;
}

export function normalizeStringArray(
  value: unknown,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => toNullableString(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}
