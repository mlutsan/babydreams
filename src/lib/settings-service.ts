/**
 * Client-side settings service
 * All business logic runs in the browser
 */

import {
  getSheetValues,
  appendSheetValues,
  updateSheetValues,
} from "~/server/proxy";

const SETTINGS_SHEET = "Settings";
const HEADER = ["Setting", "Value"] as const;
const KEY_BABY_NAME = "Baby name";
const KEY_BIRTHDATE = "Birthdate";

/**
 * Normalize value to string
 */
function normalize(str: unknown): string {
  return typeof str === "string" ? str.trim() : "";
}

/**
 * Pad number with leading zero
 */
function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Normalize various date inputs into YYYY-MM-DD or empty string if invalid
 */
export function toYyyyMmDd(input: string): string {
  const s = normalize(input);
  if (!s) {
    return "";
  }

  // If ISO datetime, take date part
  const isoDatePart = s.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoDatePart) {
    return isoDatePart[0];
  }

  // YYYY/MM/DD or YYYY.MM.DD
  let m = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (y && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${pad2(mo)}-${pad2(d)}`;
    }
  }

  // DD.MM.YYYY
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (y && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${pad2(mo)}-${pad2(d)}`;
    }
  }

  // MM/DD/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    const y = Number(m[3]);
    if (y && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${pad2(mo)}-${pad2(d)}`;
    }
  }

  // Last resort: Date.parse
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
  }

  return "";
}

/**
 * Get settings from Google Sheets
 */
export async function getSettings(sheetUrl: string): Promise<{
  success: boolean;
  babyName: string;
  babyBirthdate: string;
}> {
  const range = `${SETTINGS_SHEET}!A:B`;

  try {
    const result = (await getSheetValues({ data: { sheetUrl, range } })) as { values?: unknown[][] };
    const rows = (result.values as unknown[][]) || [];

    let babyName = "";
    let babyBirthdate = "";

    for (let i = 0; i < rows.length; i++) {
      const [k, v] = rows[i] ?? [];
      const key = normalize(k);
      const val = normalize(v);
      if (key === KEY_BABY_NAME) {
        babyName = val;
      }
      if (key === KEY_BIRTHDATE) {
        babyBirthdate = val;
      }
    }

    // Ensure birthdate is in YYYY-MM-DD for the UI date input
    const normalizedBirthdate = toYyyyMmDd(babyBirthdate);
    return { success: true, babyName, babyBirthdate: normalizedBirthdate };
  } catch (e) {
    throw new Error(
      `Failed to load Settings: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

/**
 * Save settings to Google Sheets
 */
export async function saveSettings(params: {
  sheetUrl: string;
  babyName: string;
  babyBirthdate: string;
}): Promise<{ success: boolean }> {
  const { sheetUrl, babyName, babyBirthdate } = params;
  const tableRange = `${SETTINGS_SHEET}!A:B`;

  try {
    // Load current values to find row indexes
    const current = (await getSheetValues({ data: { sheetUrl, range: tableRange } })) as { values?: unknown[][] };
    const rows: unknown[][] = current.values || [];

    // Ensure header exists at A1:B1
    let headerOk = false;
    if (rows.length > 0) {
      const h0 = normalize(rows[0]?.[0]);
      const h1 = normalize(rows[0]?.[1]);
      headerOk = h0 === HEADER[0] && h1 === HEADER[1];
    }

    if (!headerOk) {
      // Write header
      await updateSheetValues({
        data: {
          sheetUrl,
          range: `${SETTINGS_SHEET}!A1:B1`,
          values: [[HEADER[0], HEADER[1]]],
        },
      });
    }

    // Refresh rows after potential header write
    const afterHeader = (await getSheetValues({ data: { sheetUrl, range: tableRange } })) as { values?: unknown[][] };
    const dataRows: unknown[][] = afterHeader.values || [];

    // Search for keys (skip header at index 0)
    let nameRow: number | null = null;
    let birthRow: number | null = null;
    for (let i = 1; i < dataRows.length; i++) {
      const key = normalize(dataRows[i]?.[0]);
      if (key === KEY_BABY_NAME) {
        nameRow = i + 1; // 1-based row index
      }
      if (key === KEY_BIRTHDATE) {
        birthRow = i + 1;
      }
    }

    // Upsert Baby name
    if (nameRow) {
      await updateSheetValues({
        data: {
          sheetUrl,
          range: `${SETTINGS_SHEET}!A${nameRow}:B${nameRow}`,
          values: [[KEY_BABY_NAME, babyName || ""]],
        },
      });
    } else {
      await appendSheetValues({
        data: {
          sheetUrl,
          range: tableRange,
          values: [[KEY_BABY_NAME, babyName || ""]],
        },
      });
    }

    // Upsert Birthdate
    const birthFormatted = toYyyyMmDd(babyBirthdate || "");
    if (birthRow) {
      await updateSheetValues({
        data: {
          sheetUrl,
          range: `${SETTINGS_SHEET}!A${birthRow}:B${birthRow}`,
          values: [[KEY_BIRTHDATE, birthFormatted]],
        },
      });
    } else {
      await appendSheetValues({
        data: {
          sheetUrl,
          range: tableRange,
          values: [[KEY_BIRTHDATE, birthFormatted]],
        },
      });
    }

    return { success: true };
  } catch (e) {
    throw new Error(
      `Failed to save settings: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

/**
 * Validate that settings header exists
 */
export async function validateSettingsHeader(
  sheetUrl: string
): Promise<{ ok: boolean }> {
  try {
    const head = (await getSheetValues({
      data: {
        sheetUrl,
        range: `${SETTINGS_SHEET}!A1:B1`,
      },
    })) as { values?: unknown[][] };
    const [h0, h1] = (head.values?.[0] ?? ["", ""]) as unknown[];
    const ok = normalize(h0) === HEADER[0] && normalize(h1) === HEADER[1];
    return { ok };
  } catch (e) {
    throw new Error(
      `Failed to validate Settings header: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}
