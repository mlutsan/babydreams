/**
 * Jotai atoms for global state management
 * Using atomWithStorage for persistent state across sessions
 */

import { atomWithStorage } from "jotai/utils";

/**
 * Auth state atom - tracks Google authentication status
 */
export type AuthState = "signed-out" | "signed-in" | "error";
export const authStateAtom = atomWithStorage<AuthState>("auth_state", "signed-out");

/**
 * Google user profile atom - persists user profile from Google
 */
export interface GoogleUser {
  name: string;
  email: string;
  picture?: string;
}

export const googleUserAtom = atomWithStorage<GoogleUser | null>("google_user", null);

/**
 * Sheet URL atom - persists Google Sheets URL
 */
export const sheetUrlAtom = atomWithStorage<string>("sheetUrl", "");

/**
 * Baby name atom - persists baby's name
 */
export const babyNameAtom = atomWithStorage<string>("baby_name", "");

/**
 * Baby birthdate atom - persists baby's birthdate in YYYY-MM-DD format
 */
export const babyBirthdateAtom = atomWithStorage<string>("baby_birthdate", "");

/**
 * Google access token with expiry
 */
export interface TokenData {
  accessToken: string;
  expiresAt: number;
}

export const googleTokenAtom = atomWithStorage<TokenData | null>("google_access_token", null);

/**
 * Helper function to check if token is expired
 */
export function isTokenExpired(tokenData: TokenData | null): boolean {
  if (!tokenData) {
    return true;
  }
  return Date.now() > tokenData.expiresAt;
}

/**
 * Helper function to get valid access token
 */
export function getValidAccessToken(tokenData: TokenData | null): string | null {
  if (!tokenData || isTokenExpired(tokenData)) {
    return null;
  }
  return tokenData.accessToken;
}
