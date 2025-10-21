/**
 * Jotai atoms for global state management
 * Using atomWithStorage for persistent state across sessions
 */

import { atomWithStorage } from "jotai/utils";

/**
 * Random name generator for user display names
 */
const ADJECTIVES = [
  "Unknown", "Mysterious", "Curious", "Wandering", "Happy",
  "Sleepy", "Grumpy", "Dancing", "Flying", "Sneaky",
  "Brave", "Mighty", "Tiny", "Giant", "Swift"
];

const NOUNS = [
  "Potato", "Banana", "Penguin", "Dragon", "Unicorn",
  "Wizard", "Ninja", "Pirate", "Robot", "Panda",
  "Cactus", "Muffin", "Narwhal", "Llama", "Walrus"
];

function generateRandomName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adjective} ${noun}`;
}

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
 * User name atom - persists user's display name for expense tracking
 * Automatically initializes with a random name like "Unknown Potato"
 */
export const userNameAtom = atomWithStorage<string>("g-finance-user-name", generateRandomName(), undefined, {
  getOnInit: true
});

/**
 * Export the generator function for the Random button in settings
 */
export { generateRandomName };

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
