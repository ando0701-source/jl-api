export function nowEpochSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function randomId(): string {
  try {
    // @ts-ignore
    return crypto.randomUUID();
  } catch {
    const ts = nowEpochSec();
    return `${ts}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  }
}

export async function sha256Hex(input: string): Promise<string | null> {
  try {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}
