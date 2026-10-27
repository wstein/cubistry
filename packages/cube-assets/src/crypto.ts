/** Browser capability boundary, checked lazily rather than during module import. */
import { demand } from "@cubistry/cube-core";
export function requireWebCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  const port = globalThis.location?.port;
  demand(
    subtle && typeof subtle.digest === "function",
    `Secure Web Crypto is unavailable. Open http://localhost${port ? ":" + port : ""} on the same computer, or use HTTPS. Plain HTTP on a LAN IP cannot provide the required integrity checks.`,
  );
  return subtle;
}
export async function sha256(bytes: Uint8Array): Promise<string> {
  const subtle = requireWebCrypto();
  return [...new Uint8Array(await subtle.digest("SHA-256", new Uint8Array(bytes).buffer))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
