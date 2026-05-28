const API_NAIVE_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
const TIMEZONE_SUFFIX_RE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

function normalizeApiDateTime(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (TIMEZONE_SUFFIX_RE.test(trimmed)) return trimmed;
  if (!API_NAIVE_DATETIME_RE.test(trimmed)) return trimmed;
  return `${trimmed.replace(" ", "T")}Z`;
}

export function formatChinaTime(iso?: string | null): string {
  if (!iso) return "-";
  const normalized = normalizeApiDateTime(iso);
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false
  });
}
