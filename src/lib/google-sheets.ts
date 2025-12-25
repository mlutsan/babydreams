/**
 * Google Sheets API Client (Server-side only)
 * Provides utilities for interacting with Google Sheets API using direct fetch calls
 */

import { getAccessToken } from "~/server/sa-auth";

// Re-export shared utilities for backward compatibility
export {
  serialNumberToDate,
  serialNumberToTime,
  dateToSerialNumber,
  formatDateYYYYMMDD,
  extractSpreadsheetId,
} from "./sheets-utils";

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

export interface BatchUpdateResponse {
  replies?: unknown[];
  [key: string]: unknown;
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
   * Uses UNFORMATTED_VALUE with SERIAL_NUMBER for dates
   * Dates come back as Excel serial numbers (days since Dec 30, 1899)
   * Use serialNumberToDate() helper to convert to JS Date objects
   */
  async getValues(range: string): Promise<ValueRange> {
    const params = new URLSearchParams({
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    });
    return this.request<ValueRange>(
      `/values/${encodeURIComponent(range)}?${params.toString()}`
    );
  }

  /**
   * Append values to a sheet
   * @param range - A1 notation of the range to search for a table (e.g., 'Expenses!A:F')
   * @param values - 2D array of values to append
   * @param insertDataOption - How to insert data: 'OVERWRITE' or 'INSERT_ROWS' (default)
   * @param valueInputOption - How to interpret input:
   *   - 'USER_ENTERED' (default): Parse values as if user typed them (dates/numbers/formulas)
   *   - 'RAW': Store exactly as-is with no parsing
   *
   * Default is USER_ENTERED so dates like "2025-10-30" are stored as proper dates
   */
  async appendValues(
    range: string,
    values: unknown[][],
    insertDataOption: "OVERWRITE" | "INSERT_ROWS" = "INSERT_ROWS",
    valueInputOption: "RAW" | "USER_ENTERED" = "USER_ENTERED"
  ): Promise<AppendValuesResponse> {
    return this.request<AppendValuesResponse>(
      `/values/${encodeURIComponent(range)}:append?valueInputOption=${valueInputOption}&insertDataOption=${insertDataOption}`,
      {
        method: "POST",
        body: JSON.stringify({ values }),
      }
    );
  }

  /**
   * Update values in a specific range
   * @param valueInputOption - How to interpret input:
   *   - 'USER_ENTERED' (default): Parse values as if user typed them (dates/numbers/formulas)
   *   - 'RAW': Store exactly as-is with no parsing
   *
   * Default is USER_ENTERED so dates like "2025-10-30" are stored as proper dates
   */
  async updateValues(
    range: string,
    values: unknown[][],
    valueInputOption: "RAW" | "USER_ENTERED" = "USER_ENTERED"
  ): Promise<UpdateValuesResponse> {
    return this.request<UpdateValuesResponse>(
      `/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`,
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

  /**
   * Run a batch update request
   */
  async batchUpdate(requests: unknown[]): Promise<BatchUpdateResponse> {
    return this.request<BatchUpdateResponse>(`/:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests }),
    });
  }

  /**
   * Delete rows from a sheet
   */
  async deleteRows(sheetId: number, startIndex: number, endIndex: number): Promise<BatchUpdateResponse> {
    return this.batchUpdate([{
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex,
          endIndex,
        },
      },
    }]);
  }
}
