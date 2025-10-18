/**
 * Google Sheets API Client using @googleapis/sheets
 * Provides utilities for interacting with Google Sheets API
 */

import { sheets_v4, sheets } from "@googleapis/sheets";
import { OAuth2Client } from "google-auth-library";

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

/**
 * Extract spreadsheet ID from various Google Sheets URL formats
 */
export function extractSpreadsheetId(url: string): string | null {
  // Handle different URL formats:
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit...
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Get tokens from request cookies
 */
export function getTokensFromRequest(request: Request): GoogleTokens | null {
  const cookies = request.headers.get("cookie") || "";
  const tokensCookie = cookies
    .split(";")
    .find((c) => c.trim().startsWith("google_tokens="))
    ?.split("=")[1];

  if (!tokensCookie) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(tokensCookie));
  } catch {
    return null;
  }
}

/**
 * Google Sheets API client using @googleapis/sheets
 */
export class GoogleSheetsClient {
  private sheetsApi: sheets_v4.Sheets;
  private spreadsheetId: string;

  constructor(accessToken: string, spreadsheetId: string) {
    // Create OAuth2 client and set credentials
    const authClient = new OAuth2Client();
    authClient.setCredentials({
      access_token: accessToken,
    });

    // Create sheets API instance with auth client
    this.sheetsApi = sheets({
      version: "v4",
      auth: authClient,
    });
    this.spreadsheetId = spreadsheetId;
  }

  /**
   * Get spreadsheet metadata
   */
  async getSpreadsheetMetadata(): Promise<sheets_v4.Schema$Spreadsheet> {
    try {
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch spreadsheet metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get values from a specific range
   */
  async getValues(range: string): Promise<sheets_v4.Schema$ValueRange> {
    try {
      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch values: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Append values to a sheet
   */
  async appendValues(range: string, values: unknown[][]): Promise<sheets_v4.Schema$AppendValuesResponse> {
    try {
      const response = await this.sheetsApi.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values,
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to append values: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update values in a specific range
   */
  async updateValues(range: string, values: unknown[][]): Promise<sheets_v4.Schema$UpdateValuesResponse> {
    try {
      const response = await this.sheetsApi.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values,
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to update values: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clear values in a specific range
   */
  async clearValues(range: string): Promise<sheets_v4.Schema$ClearValuesResponse> {
    try {
      const response = await this.sheetsApi.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range,
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to clear values: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Create a Google Sheets client from request
 */
export function createSheetsClient(
  request: Request,
  spreadsheetUrl: string
): GoogleSheetsClient | null {
  const tokens = getTokensFromRequest(request);
  if (!tokens) {
    return null;
  }

  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
  if (!spreadsheetId) {
    return null;
  }

  return new GoogleSheetsClient(tokens.access_token, spreadsheetId);
}
