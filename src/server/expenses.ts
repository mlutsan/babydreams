/**
 * Server-side expense management functions
 * Handles CRUD operations for expenses in Google Sheets
 */

import { createServerFn } from "@tanstack/react-start";
import { GoogleSheetsClient, extractSpreadsheetId } from "~/lib/google-sheets";
import { getAccessToken } from "./sa-auth";

/**
 * Expense input data structure
 */
interface ExpenseInput {
  amount: number;
  date: string;
  category: string;
  description: string;
  authorName: string;
  sheetUrl: string;
}

/**
 * Create a new expense in Google Sheets
 */
export const createExpense = createServerFn({ method: "POST" })
  .inputValidator((data: ExpenseInput) => {
    // Validate required fields
    if (!data.amount || data.amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }
    if (!data.date) {
      throw new Error("Date is required");
    }
    if (!data.category || data.category.trim() === "") {
      throw new Error("Category is required");
    }
    if (!data.authorName || data.authorName.trim() === "") {
      throw new Error("Author name is required");
    }
    if (!data.sheetUrl) {
      throw new Error("Sheet URL is required");
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.date)) {
      throw new Error("Date must be in YYYY-MM-DD format");
    }

    return data;
  })
  .handler(async ({ data }) => {
    // Verify access token
    //await verifyAccessToken(data.accessToken);
    const token = await getAccessToken();

    // Extract spreadsheet ID
    const spreadsheetId = extractSpreadsheetId(data.sheetUrl);
    if (!spreadsheetId) {
      throw new Error("Invalid Google Sheets URL");
    }

    // Create Google Sheets client
    const client = new GoogleSheetsClient(token, spreadsheetId);

    try {
      // Append expense to sheet
      // Schema: Date | Category | Amount | Description | Author
      const result = await client.appendValues("Expenses!A:E", [
        [
          data.date,
          data.category,
          data.amount,
          data.description || "",
          data.authorName,
        ],
      ]);

      return {
        success: true,
        message: "Expense saved successfully",
        updatedRange: result.updates?.updatedRange,
      };
    } catch (error) {
      // Check if error is because sheet doesn't exist
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("Unable to parse range") ||
        errorMessage.includes("not found")) {
        // Try to create the Expenses sheet
        try {
          // TODO: Implement sheet creation logic
          // For now, throw a helpful error
          throw new Error(
            "Expenses sheet not found. Please create an 'Expenses' sheet in your Google Spreadsheet with columns: Date | Category | Amount | Description | Author"
          );
        } catch (createError) {
          throw createError;
        }
      }

      throw new Error(
        `Failed to save expense: ${errorMessage}`
      );
    }
  });
