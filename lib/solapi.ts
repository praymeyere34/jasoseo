import { env } from "cloudflare:workers";

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function credentials(): { apiKey: string; apiSecret: string; senderNumber: string } | null {
  const apiKey = env.SOLAPI_API_KEY?.trim();
  const apiSecret = env.SOLAPI_API_SECRET?.trim();
  const senderNumber = env.SOLAPI_SENDER_NUMBER?.replace(/\D/g, "");
  return apiKey && apiSecret && senderNumber ? { apiKey, apiSecret, senderNumber } : null;
}

export function solapiConfigured(): boolean {
  return credentials() !== null;
}

export async function verificationCodeHash(phone: string, code: string): Promise<string> {
  const configured = credentials();
  if (!configured) throw new Error("SOLAPI is not configured");
  return hmacHex(configured.apiSecret, `${phone}:${code}`);
}

export async function createPhoneVerificationToken(phone: string): Promise<string> {
  const configured = credentials();
  if (!configured) throw new Error("SOLAPI is not configured");
  const expiresAt = Math.floor(Date.now() / 1000) + 600;
  const payload = `${phone}.${expiresAt}`;
  return `${payload}.${await hmacHex(configured.apiSecret, payload)}`;
}

export async function verifyPhoneVerificationToken(phone: string, token: unknown): Promise<boolean> {
  const configured = credentials();
  if (!configured || typeof token !== "string") return false;
  const [tokenPhone, expiresAtText, signature, ...rest] = token.split(".");
  if (rest.length || tokenPhone !== phone || !/^\d+$/.test(expiresAtText ?? "") || !/^[a-f0-9]{64}$/.test(signature ?? "")) return false;
  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacHex(configured.apiSecret, `${tokenPhone}.${expiresAtText}`);
  return safeEqualHex(signature, expected);
}

export function safeEqualHex(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index++) mismatch |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}

export async function sendVerificationSms(phone: string, code: string): Promise<void> {
  const configured = credentials();
  if (!configured) throw new Error("SOLAPI is not configured");

  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replaceAll("-", "");
  const signature = await hmacHex(configured.apiSecret, date + salt);
  const response = await fetch("https://api.solapi.com/messages/v4/send-many/detail", {
    method: "POST",
    headers: {
      Authorization: `HMAC-SHA256 apiKey=${configured.apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{
        to: phone,
        from: configured.senderNumber,
        text: `[이어쓰기] 인증번호는 ${code}입니다. 5분 안에 입력해 주세요.`,
        type: "SMS",
        country: "82",
      }],
      strict: true,
      showMessageList: true,
    }),
  });

  const result = await response.json().catch(() => null) as {
    failedMessageList?: unknown[];
    groupInfo?: { count?: { registeredSuccess?: number } };
  } | null;
  const accepted = result?.groupInfo?.count?.registeredSuccess;
  if (!response.ok || result?.failedMessageList?.length || accepted !== 1) {
    throw new Error(`SOLAPI send failed (${response.status})`);
  }
}
