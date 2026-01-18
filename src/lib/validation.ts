/**
 * Input validation and sanitization utilities
 * Security: Protects against XSS, injection attacks, and invalid data
 */

/**
 * Sanitize string input by removing potentially dangerous characters
 * Removes: HTML tags, script injection patterns, null bytes
 */
export const sanitizeString = (input: string): string => {
  if (typeof input !== "string") return "";
  return input
    .trim()
    // Remove HTML tags
    .replace(/<[^>]*>/g, "")
    // Remove potential script injection patterns
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    // Remove null bytes
    .replace(/\0/g, "")
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
};

/**
 * Validate email format with RFC 5322 compliant regex
 */
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== "string") return false;
  // More comprehensive email validation
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return email.length <= 254 && emailRegex.test(email);
};

/**
 * Validate phone number format
 * Must contain at least 10 digits and only valid phone characters
 */
export const validatePhone = (phone: string): boolean => {
  if (!phone || typeof phone !== "string") return false;
  // Only allow digits, spaces, hyphens, plus, and parentheses
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  const digitsOnly = phone.replace(/\D/g, "");
  // Must have between 10-15 digits (international standard)
  return phoneRegex.test(phone) && digitsOnly.length >= 10 && digitsOnly.length <= 15;
};

/**
 * Validate name (alphanumeric, spaces, hyphens, apostrophes only)
 */
export const validateName = (name: string): boolean => {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  // Allow letters, spaces, hyphens, apostrophes, and common name characters
  const nameRegex = /^[\p{L}\s\-'\.]+$/u;
  return trimmed.length >= 2 && trimmed.length <= 100 && nameRegex.test(trimmed);
};

export const sanitizeInput = (input: any): string => {
  if (typeof input !== "string") return "";
  return sanitizeString(input);
};

export const validateProfileUpdate = (data: {
  full_name?: string;
  phone?: string;
  city?: string;
}): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (data.full_name !== undefined) {
    if (!validateName(data.full_name)) {
      errors.push("Name must be between 2 and 100 characters");
    }
  }

  if (data.phone !== undefined && data.phone) {
    if (!validatePhone(data.phone)) {
      errors.push("Invalid phone number format");
    }
  }

  if (data.city !== undefined && data.city) {
    if (data.city.trim().length < 2 || data.city.trim().length > 100) {
      errors.push("City must be between 2 and 100 characters");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Rate limiting helper (client-side check)
 * Note: Actual rate limiting should be implemented server-side
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export const checkRateLimit = (
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): boolean => {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
};










