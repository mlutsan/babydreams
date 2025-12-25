/**
 * Thin proxy layer for Google Sheets API
 * Handles service account authentication and forwards requests
 * No business logic - just pass-through to Google Sheets
 */

import { createServerFn } from "@tanstack/react-start";
import {
  GoogleSheetsClient,
} from "~/lib/google-sheets";
import { extractSpreadsheetId } from "~/lib/sheets-utils";

/**
 * Create authenticated Google Sheets client
 */
async function getClient(sheetUrl: string) {
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) {
    throw new Error("Invalid Google Sheets URL");
  }
  return GoogleSheetsClient.createWithServiceAccount(spreadsheetId);
}

/**
 * Get values from a range (uses UNFORMATTED_VALUE + SERIAL_NUMBER)
 */
export const getSheetValues = createServerFn({ method: "POST" })
  .inputValidator((data: { sheetUrl: string; range: string; }) => {
    if (!data.sheetUrl) {
      throw new Error("Sheet URL is required");
    }
    if (!data.range) {
      throw new Error("Range is required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const client = await getClient(data.sheetUrl);
    return client.getValues(data.range) as any;
  });

/**
 * Append values to a range
 */
export const appendSheetValues = createServerFn({ method: "POST" })
  .inputValidator((data: {
    sheetUrl: string;
    range: string;
    values: unknown[][];
    insertDataOption?: "OVERWRITE" | "INSERT_ROWS";
    valueInputOption?: "RAW" | "USER_ENTERED";
  }) => {
    if (!data.sheetUrl) {
      throw new Error("Sheet URL is required");
    }
    if (!data.range) {
      throw new Error("Range is required");
    }
    if (!data.values) {
      throw new Error("Values are required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const client = await getClient(data.sheetUrl);
    return client.appendValues(
      data.range,
      data.values,
      data.insertDataOption,
      data.valueInputOption
    ) as any;
  });

/**
 * Update values in a specific range
 */
export const updateSheetValues = createServerFn({ method: "POST" })
  .inputValidator((data: {
    sheetUrl: string;
    range: string;
    values: unknown[][];
    valueInputOption?: "RAW" | "USER_ENTERED";
  }) => {
    if (!data.sheetUrl) {
      throw new Error("Sheet URL is required");
    }
    if (!data.range) {
      throw new Error("Range is required");
    }
    if (!data.values) {
      throw new Error("Values are required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const client = await getClient(data.sheetUrl);
    return client.updateValues(
      data.range,
      data.values,
      data.valueInputOption
    ) as any;
  });

/**
 * Delete a single row from a sheet
 */
export const deleteSheetRow = createServerFn({ method: "POST" })
  .inputValidator((data: {
    sheetUrl: string;
    sheetName: string;
    rowIndex: number;
  }) => {
    if (!data.sheetUrl) {
      throw new Error("Sheet URL is required");
    }
    if (!data.sheetName) {
      throw new Error("Sheet name is required");
    }
    if (!Number.isInteger(data.rowIndex) || data.rowIndex < 1) {
      throw new Error("rowIndex must be a positive integer");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const client = await getClient(data.sheetUrl);
    const metadata = await client.getSpreadsheetMetadata();
    const sheet = metadata.sheets?.find(
      (item) => item.properties?.title === data.sheetName
    );
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId === undefined) {
      throw new Error(`Sheet not found: ${data.sheetName}`);
    }

    const startIndex = data.rowIndex - 1;
    const endIndex = data.rowIndex;
    return client.deleteRows(sheetId, startIndex, endIndex) as any;
  });

/**
 * Get spreadsheet metadata
 */
export const getSheetMetadata = createServerFn({ method: "POST" })
  .inputValidator((data: { sheetUrl: string; }) => {
    if (!data.sheetUrl) {
      throw new Error("Sheet URL is required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const client = await getClient(data.sheetUrl);
    return client.getSpreadsheetMetadata() as any;
  });
