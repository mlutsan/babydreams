/**
 * Google Sheets API Client
 * Provides utilities for interacting with Google Sheets API using direct fetch calls
 */

import { getAccessToken } from "~/server/sa-auth";

// Google Sheets API response types
export interface SheetProperties {
  title?: string;
  sheetId?: number;
  [key: string]: unknown;
}

export interface Sheet {
  properties?: SheetProperties;
  [key: string]: unknown;
}

export interface SpreadsheetProperties {
  title?: string;
  [key: string]: unknown;
}

export interface Spreadsheet {
  properties?: SpreadsheetProperties;
  sheets?: Sheet[];
  [key: string]: unknown;
}

export interface ValueRange {
  values?: unknown[][];
  range?: string;
  [key: string]: unknown;
}

export interface UpdateValuesResponse {
  updatedRange?: string;
  updatedRows?: number;
  updatedColumns?: number;
  updatedCells?: number;
  [key: string]: unknown;
}

export interface AppendValuesResponse {
  updates?: UpdateValuesResponse;
  [key: string]: unknown;
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
 * Google Sheets API client
 */
export class GoogleSheetsClient {
  private accessToken: string;
  private spreadsheetId: string;
  private baseUrl = "https://sheets.googleapis.com/v4/spreadsheets";

  constructor(accessToken: string, spreadsheetId: string) {
    this.accessToken = accessToken;
    this.spreadsheetId = spreadsheetId;
  }

  /**
   * Create a client using service account credentials
   */
  static async createWithServiceAccount(
    spreadsheetId: string
  ): Promise<GoogleSheetsClient> {
    const accessToken = await getAccessToken();
    return new GoogleSheetsClient(accessToken, spreadsheetId);
  }

  /**
   * Make an authenticated request to the Sheets API
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/${this.spreadsheetId}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Sheets API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  /**
   * Get spreadsheet metadata
   */
  async getSpreadsheetMetadata(): Promise<Spreadsheet> {
    return this.request<Spreadsheet>("");
  }

  /**
   * Get values from a specific range
   */
  async getValues(range: string): Promise<ValueRange> {
    return this.request<ValueRange>(`/values/${encodeURIComponent(range)}`);
  }

  /**
   * Append values to a sheet
   */
  async appendValues(range: string, values: unknown[][]): Promise<AppendValuesResponse> {
    return this.request<AppendValuesResponse>(
      `/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        body: JSON.stringify({ values }),
      }
    );
  }

  /**
   * Update values in a specific range
   */
  async updateValues(range: string, values: unknown[][]): Promise<UpdateValuesResponse> {
    return this.request<UpdateValuesResponse>(
      `/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        body: JSON.stringify({ values }),
      }
    );
  }

  /**
   * Clear values in a specific range
   */
  async clearValues(range: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/values/${encodeURIComponent(range)}:clear`, {
      method: "POST",
    });
  }
}
