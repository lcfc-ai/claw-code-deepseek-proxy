export type SimpleLogFields = Record<string, string | number | boolean | null | undefined>;

function renderValue(value: SimpleLogFields[string]): string {
  if (value === undefined) {
    return "-";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

export function simpleLog(enabled: boolean, event: string, fields: SimpleLogFields = {}): void {
  if (!enabled) {
    return;
  }

  const timestamp = new Date().toISOString();
  const renderedFields = Object.entries(fields)
    .map(([key, value]) => `${key}=${renderValue(value)}`)
    .join(" ");

  if (renderedFields.length > 0) {
    console.log(`[proxy ${timestamp}] ${event} ${renderedFields}`);
    return;
  }

  console.log(`[proxy ${timestamp}] ${event}`);
}
