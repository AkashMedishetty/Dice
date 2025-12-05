/**
 * Validates email format
 * @param email - The email string to validate
 * @returns true if valid email format, false otherwise
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // Basic email regex that matches most valid emails
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}
