import { database, type CurrentUser } from "./server";
import { ACCOUNT_CONSENT_VERSION, SENSITIVE_CONSENT_VERSION } from "./privacy";

type ConsentRow = { kind: string };

export async function consentState(userId: string) {
  const rows = await database().prepare(
    "SELECT kind FROM user_consents WHERE user_id = ? AND ((kind = 'account' AND version = ?) OR (kind = 'sensitive' AND version = ?))",
  ).bind(userId, ACCOUNT_CONSENT_VERSION, SENSITIVE_CONSENT_VERSION).all<ConsentRow>();
  return {
    hasAccountConsent: rows.results.some((row) => row.kind === "account"),
    hasSensitiveConsent: rows.results.some((row) => row.kind === "sensitive"),
  };
}

export async function userWithConsents(user: CurrentUser) {
  return { ...user, ...await consentState(user.id) };
}
