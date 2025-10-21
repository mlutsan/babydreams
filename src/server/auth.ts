/**
 * Server-side authentication functions using Google Identity Services (GSI)
 * These functions work with OAuth2 access tokens from GSI
 */

import { createServerFn } from "@tanstack/react-start";
import { GoogleSheetsClient, extractSpreadsheetId } from "~/lib/google-sheets";

/**
 * Verify Google access token by making a test API call
 */
async function verifyAccessToken(accessToken: string): Promise<{ email?: string; }> {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Invalid access token");
    }

    return await response.json();
  } catch (error) {
    console.error("Token verification failed:", error);
    throw new Error("Invalid authentication token");
  }
}

/**
 * Check Google authentication status from client
 */
export const checkGoogleAuthStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken?: string; }) => data)
  .handler(async ({ data }) => {
    const { accessToken } = data;

    if (!accessToken) {
      return {
        connected: false,
        reason: "no_token",
      };
    }

    try {
      const userInfo = await verifyAccessToken(accessToken);

      return {
        connected: true,
        email: userInfo.email || null,
      };
    } catch {
      return {
        connected: false,
        reason: "invalid_token",
      };
    }
  });

/**
 * Get Google Sheet metadata
 * Fetches spreadsheet information to verify access
 */
export const getMetadata = createServerFn({ method: "POST" })
  .inputValidator((data: { sheetUrl: string; }) => {
    if (!data.sheetUrl) {
      throw new Error("Sheet URL is required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const { sheetUrl } = data;

    // Extract spreadsheet ID from URL
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      throw new Error("Invalid Google Sheets URL");
    }

    // Create Google Sheets client with the access token
    const client = await GoogleSheetsClient.createWithServiceAccount(spreadsheetId);

    // Fetch metadata
    try {
      const metadata = await client.getSpreadsheetMetadata();

      return {
        success: true,
        title: metadata.properties?.title || "Unknown",
        sheetCount: metadata.sheets?.length || 0,
        sheets:
          metadata.sheets?.map((sheet) => ({
            title: sheet.properties?.title || "Untitled",
            sheetId: sheet.properties?.sheetId || 0,
          })) || [],
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch metadata: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
