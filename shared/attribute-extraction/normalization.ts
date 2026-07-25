export function normalizeAttributeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyAttributeValue(value: string | null | undefined): string | null {
  const normalized = normalizeAttributeText(value).replace(/\s+/g, "-");
  return normalized || null;
}
