/**
 * Date Utility for Buddhist Era (พ.ศ.) and Gregorian Era (ค.ศ.) conversions,
 * leap year handling, format standardizations, and anti-ambiguity date parsing.
 */

/**
 * Checks if a Gregorian year is a leap year.
 */
export function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Checks if a Buddhist Era year (พ.ศ.) is a leap year.
 * (พ.ศ. = ค.ศ. + 543)
 */
export function isBuddhistLeapYear(beYear: number): boolean {
  const ceYear = beYear - 543;
  return isGregorianLeapYear(ceYear);
}

/**
 * Normalizes any Thai or ISO date string (e.g., '29/02/2567', '2024-02-29', '29-02-2024')
 * into standard DD/MM/YYYY (พ.ศ.) or standard ISO (ค.ศ.) safely without locale corruption.
 *
 * Specifically handles 29 กุมภาพันธ์ (Leap Year) in both พ.ศ. (2567 -> 2024) and ค.ศ.
 */
export function parseThaiOrIsoDate(
  dateStr: string | null | undefined
): { day: number; month: number; yearCE: number; yearBE: number; formattedBE: string; formattedISO: string } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed || trimmed === '-' || trimmed === 'null' || trimmed === 'undefined') return null;

  let day: number = 0;
  let month: number = 0;
  let year: number = 0;

  // Format 1: DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    day = parseInt(slashMatch[1], 10);
    month = parseInt(slashMatch[2], 10);
    year = parseInt(slashMatch[3], 10);
  } else {
    // Format 2: YYYY-MM-DD or YYYY/MM/DD (ISO standard)
    const isoMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (isoMatch) {
      year = parseInt(isoMatch[1], 10);
      month = parseInt(isoMatch[2], 10);
      day = parseInt(isoMatch[3], 10);
    } else {
      // Fallback JS Date parsing for timestamps like "2026-08-30T10:00:00.000Z"
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        day = parsed.getDate();
        month = parsed.getMonth() + 1;
        year = parsed.getFullYear();
      } else {
        return null;
      }
    }
  }

  if (month < 1 || month > 12 || day < 1) return null;

  let yearCE: number;
  let yearBE: number;

  if (year > 2400) {
    // Input is in Buddhist Era (พ.ศ.)
    yearBE = year;
    yearCE = year - 543;
  } else {
    // Input is in Common Era (ค.ศ.)
    yearCE = year;
    yearBE = year + 543;
  }

  // Validate day bounds per month considering leap year
  const daysInMonth = [
    31,
    isGregorianLeapYear(yearCE) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  if (day > daysInMonth[month - 1]) {
    return null; // Invalid day for that month/year
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const formattedBE = `${pad(day)}/${pad(month)}/${yearBE}`;
  const formattedISO = `${yearCE}-${pad(month)}-${pad(day)}`;

  return {
    day,
    month,
    yearCE,
    yearBE,
    formattedBE,
    formattedISO,
  };
}

/**
 * Converts a date string to JavaScript Date safely, ensuring year conversion if given in พ.ศ.
 */
export function toSafeJsDate(dateStr: string | null | undefined): Date | null {
  const parsed = parseThaiOrIsoDate(dateStr);
  if (!parsed) return null;
  return new Date(parsed.yearCE, parsed.month - 1, parsed.day);
}
