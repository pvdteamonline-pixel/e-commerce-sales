/**
 * Security Utilities for E-commerce Sales Management Web Application
 * Provides protection against:
 * 1. Brute-force attacks (Rate Limiting & Temporary Lockout)
 * 2. CSV / Excel Formula Injection (DDE attacks)
 * 3. File upload abuse (Type and Size validation)
 * 4. Input sanitization (XSS mitigation)
 */

// ----------------------------------------------------------------------
// 1. Login Rate Limiting & Brute-force Protection
// ----------------------------------------------------------------------
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds
const STORAGE_KEY_LOGIN_ATTEMPTS = "sec_login_failed_attempts";
const STORAGE_KEY_LOCKOUT_UNTIL = "sec_login_lockout_until";

export interface LockoutStatus {
  isLocked: boolean;
  remainingSeconds: number;
  failedAttempts: number;
}

export const getLoginLockoutStatus = (): LockoutStatus => {
  try {
    const lockoutUntilStr = localStorage.getItem(STORAGE_KEY_LOCKOUT_UNTIL);
    const failedAttemptsStr = localStorage.getItem(STORAGE_KEY_LOGIN_ATTEMPTS);
    const failedAttempts = failedAttemptsStr ? parseInt(failedAttemptsStr, 10) || 0 : 0;

    if (lockoutUntilStr) {
      const lockoutUntil = parseInt(lockoutUntilStr, 10) || 0;
      const now = Date.now();
      if (now < lockoutUntil) {
        const remainingSeconds = Math.ceil((lockoutUntil - now) / 1000);
        return { isLocked: true, remainingSeconds, failedAttempts };
      } else {
        // Lockout expired, clear lockout time
        localStorage.removeItem(STORAGE_KEY_LOCKOUT_UNTIL);
      }
    }

    return { isLocked: false, remainingSeconds: 0, failedAttempts };
  } catch {
    return { isLocked: false, remainingSeconds: 0, failedAttempts: 0 };
  }
};

export const recordFailedLogin = (): LockoutStatus => {
  try {
    const current = getLoginLockoutStatus();
    const newAttempts = current.failedAttempts + 1;
    localStorage.setItem(STORAGE_KEY_LOGIN_ATTEMPTS, newAttempts.toString());

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      localStorage.setItem(STORAGE_KEY_LOCKOUT_UNTIL, lockoutUntil.toString());
      return {
        isLocked: true,
        remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        failedAttempts: newAttempts,
      };
    }

    return { isLocked: false, remainingSeconds: 0, failedAttempts: newAttempts };
  } catch {
    return { isLocked: false, remainingSeconds: 0, failedAttempts: 1 };
  }
};

export const resetFailedLogins = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY_LOGIN_ATTEMPTS);
    localStorage.removeItem(STORAGE_KEY_LOCKOUT_UNTIL);
  } catch {
    // ignore
  }
};

// ----------------------------------------------------------------------
// 2. CSV / Excel Formula Injection Sanitization (Formula Injection / DDE)
// ----------------------------------------------------------------------
/**
 * Neutralizes potentially malicious formulas that start with =, +, -, @, \t, \r
 * by prepending a single quote (') so Excel treats it strictly as plain text.
 */
export const sanitizeCellForExport = (value: unknown): unknown => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      trimmed.startsWith("=") ||
      trimmed.startsWith("+") ||
      trimmed.startsWith("-") ||
      trimmed.startsWith("@") ||
      trimmed.startsWith("\t") ||
      trimmed.startsWith("\r")
    ) {
      // If it looks like an intended negative number (e.g. "-123.45"), keep it safe as number
      if (trimmed.startsWith("-") && !isNaN(Number(trimmed))) {
        return Number(trimmed);
      }
      return `'${value}`;
    }
  }
  return value;
};

/**
 * Sanitizes all string fields in an array of records before Excel/CSV export
 */
export const sanitizeDataForExport = <T extends Record<string, unknown>>(data: T[]): T[] => {
  return data.map((row) => {
    const cleanRow: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(row)) {
      cleanRow[key] = sanitizeCellForExport(val);
    }
    return cleanRow as T;
  });
};

// ----------------------------------------------------------------------
// 3. File Upload Validation & Safety
// ----------------------------------------------------------------------
export const MAX_FILE_SIZE_BYTES = 35 * 1024 * 1024; // 35 MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export const validateUploadedFile = (file: File): FileValidationResult => {
  if (!file) {
    return { valid: false, error: "ไม่พบไฟล์ที่เลือก" };
  }

  // 1. Check size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `ขนาดไฟล์ (${sizeMb} MB) เกินขีดจำกัดความปลอดภัยสูงสุด (35 MB)`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: "ไฟล์ว่างเปล่า (0 Bytes)" };
  }

  // 2. Check extension
  const fileName = file.name.toLowerCase();
  const validExtensions = [".xlsx", ".xls", ".csv"];
  const hasValidExt = validExtensions.some((ext) => fileName.endsWith(ext));

  if (!hasValidExt) {
    return {
      valid: false,
      error: "นามสกุลไฟล์ไม่ถูกต้อง รองรับเฉพาะไฟล์ .xlsx, .xls และ .csv เท่านั้น",
    };
  }

  return { valid: true };
};

// ----------------------------------------------------------------------
// 4. Input Text Sanitizer (Basic XSS / dangerous characters stripping)
// ----------------------------------------------------------------------
export const sanitizeTextInput = (input: string): string => {
  if (!input) return "";
  return input
    .replace(/[<>]/g, "") // Strip dangerous HTML tags
    .trim();
};
