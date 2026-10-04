// Shared by proxy.ts and the unlock route. The cookie stores a hash, never the passcode.

export const AUTH_COOKIE = "icare_auth";

export async function passcodeToken(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`icare:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
