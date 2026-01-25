// QuickBooks client authentication and session management

import QuickBooks from "node-quickbooks";
import { getSecret, putSecret, getCompanyId, QBCredentials } from "../aws.js";
import { promisify } from "./promisify.js";
import { clearLookupCache } from "./cache.js";
import { isQBError } from "../types/index.js";

// Sandbox mode for development/testing
const useSandbox = process.env.QBO_SANDBOX === "true";

// QuickBooks client and credentials state
let qbo: QuickBooks | null = null;
let credentials: QBCredentials | null = null;
let companyId: string | null = null;

// Export companyId getter for tools that need it
export function getCompanyIdValue(): string | null {
  return companyId;
}

// Clear cached credentials (call on auth errors to force fresh fetch)
export function clearCredentialsCache(): void {
  qbo = null;
  credentials = null;
  clearLookupCache();
}

// Check if error is an authentication failure
export function isAuthError(error: unknown): boolean {
  if (isQBError(error)) {
    const code = error.fault?.error?.[0]?.code;
    return code === '3200' || code === '401';
  }
  return false;
}

// Initialize or refresh the QuickBooks session
export async function getClient(): Promise<QuickBooks> {
  // ALWAYS fetch fresh credentials from Secrets Manager (like Python version)
  credentials = await getSecret();

  // Load company ID from SSM if not cached
  if (!companyId) {
    companyId = await getCompanyId();
  }

  // Create QuickBooks client with current tokens
  qbo = new QuickBooks(
    credentials.client_id,
    credentials.client_secret,
    credentials.access_token,
    false, // No OAuth 1.0 token secret for OAuth 2.0
    companyId,
    useSandbox, // Use sandbox if QBO_SANDBOX=true
    false, // Debug mode off
    null,  // Use latest minor version
    "2.0", // OAuth 2.0
    credentials.refresh_token
  );

  // Refresh the access token
  const tokenInfo = await promisify<{
    access_token: string;
    refresh_token: string;
  }>((cb) => qbo!.refreshAccessToken(cb));

  // Update credentials and persist to Secrets Manager immediately
  credentials.access_token = tokenInfo.access_token;
  credentials.refresh_token = tokenInfo.refresh_token;
  await putSecret(credentials);

  // Recreate client with new tokens
  qbo = new QuickBooks(
    credentials.client_id,
    credentials.client_secret,
    credentials.access_token,
    false,
    companyId,
    useSandbox,
    false, // Debug mode off
    null,
    "2.0",
    credentials.refresh_token
  );

  return qbo;
}
