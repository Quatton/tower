import { getPublicKey, utils } from "@noble/secp256k1";

export function generatePrivateKey() {
  return utils.randomPrivateKey();
}

export function derivePublicKey(privateKey: Uint8Array): string {
  return Buffer.from(getPublicKey(privateKey, true)).toString("hex");
}

export const encoder = new TextEncoder();
export const decoder = new TextDecoder();
export function pack(buff: ArrayBufferLike): string {
  return btoa(String.fromCharCode(...new Uint8Array(buff)));
}

export function unpack(packed: string): ArrayBuffer {
  const str = atob(packed);
  return new Uint8Array(str.length).map((_, i) => str.charCodeAt(i)).buffer;
}

export const sha1 = (() => {
  const sha1Cache = new Map<string, string>();

  return async (data: string) => {
    if (sha1Cache.has(data)) {
      return sha1Cache.get(data)!;
    }
    const buffer = await crypto.subtle.digest("SHA-1", encoder.encode(data));
    const hash = Array.from(new Uint8Array(buffer));
    const hex = hash.map((b) => b.toString(36)).join("");
    return hex;
  };
})();

export async function generateAESKey(password: string, roomId: string) {
  return crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`${roomId}:${password}`),
    ),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encrypt(keyPromise: Promise<CryptoKey>, data: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  return (
    (await iv.join(",")) +
    ":" +
    pack(
      await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv,
        },
        await keyPromise,
        encoder.encode(data),
      ),
    )
  );
}

export async function decrypt(
  keyPromise: Promise<CryptoKey>,
  data: string,
): Promise<string> {
  const [ivStr, packedData] = data.split(":");
  if (!ivStr || !packedData) {
    throw new Error("Invalid encrypted data format");
  }
  const iv = new Uint8Array(ivStr.split(",").map(Number));

  return decoder.decode(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      await keyPromise,
      unpack(packedData),
    ),
  );
}
