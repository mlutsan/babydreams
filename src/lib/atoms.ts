/**
 * Jotai atoms for global state management
 * Using atomWithStorage for persistent state across sessions
 */

import { atom } from "jotai";
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
export const sheetUrlAtom = atomWithStorage<string>("sheetUrl", "", undefined, {
  getOnInit: true
});

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

/**
 * Toast message atom - global state for toast notifications
 * Not persisted, only in-memory state
 */
export interface ToastMessage {
  id: string;
  message: string;
  description?: string;
  type: "success" | "error";
  duration?: number;
}

export const toastAtom = atom<ToastMessage | null>(null);
export const toastOpenAtom = atom<boolean>(false);

/**
 * Cycle settings atom - defines when day/night cycles start
 * Stored as HH:mm strings for flexibility
 */
export interface CycleSettings {
  dayStart: string; // HH:mm format, e.g., "08:00"
  dayEnd: string;   // HH:mm format, e.g., "20:00"
}

export const cycleSettingsAtom = atomWithStorage<CycleSettings>(
  "cycle_settings",
  { dayStart: "08:00", dayEnd: "20:00" }
);

/**
 * Helper function to determine if a given time is Day or Night cycle
 * @param time - Time in HH:mm format
 * @param settings - Cycle settings with dayStart and dayEnd
 * @returns "Day" if time is between dayStart and dayEnd, otherwise "Night"
 */
export function calculateCycleFromTime(
  time: string,
  settings: CycleSettings
): "Day" | "Night" {
  // Convert HH:mm to minutes since midnight for easy comparison
  const timeToMinutes = (t: string): number => {
    const [hours, minutes] = t.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const timeMinutes = timeToMinutes(time);
  const dayStartMinutes = timeToMinutes(settings.dayStart);
  const dayEndMinutes = timeToMinutes(settings.dayEnd);

  // Check if time is within day cycle
  if (timeMinutes >= dayStartMinutes && timeMinutes < dayEndMinutes) {
    return "Day";
  }

  return "Night";
}
