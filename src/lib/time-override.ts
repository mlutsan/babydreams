import dayjs, { type Dayjs } from "dayjs";

const overrideValue =
  import.meta.env?.OVERRIDE_DATETIME ?? import.meta.env?.VITE_OVERRIDE_DATETIME;

let cachedOverride: Dayjs | null | undefined;

export function getOverrideNow(): Dayjs | null {
  if (cachedOverride !== undefined) {
    return cachedOverride;
  }
  if (!overrideValue) {
    cachedOverride = null;
    return cachedOverride;
  }

  const parsed = dayjs(overrideValue);
  cachedOverride = parsed.isValid() ? parsed : null;
  return cachedOverride;
}

export function getUiNow(): Dayjs {
  return getOverrideNow() ?? dayjs();
}
