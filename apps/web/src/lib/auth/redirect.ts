/**
 * Return path after login (`/giris?next=...`). Only same-site absolute paths
 * are accepted, so a crafted link cannot send the user to another site after
 * logging in (open redirect).
 */
export function safeNextPath(value: string | null | undefined, fallback = '/asistan'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/.test(value)) {
    return fallback;
  }
  return value;
}
