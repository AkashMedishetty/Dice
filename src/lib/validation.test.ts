import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateEmail } from './validation';

/**
 * **Feature: participant-tracking, Property 1: Email Validation Correctness**
 * *For any* string input, if the string matches a valid email format 
 * (contains @ with valid local and domain parts), the system SHALL accept it; 
 * otherwise, the system SHALL reject it with a validation error.
 * **Validates: Requirements 1.2, 1.3**
 */

describe('Email Validation Property', () => {
  it('Property 1a: Valid emails are accepted', () => {
    fc.assert(
      fc.property(fc.emailAddress(), (email) => {
        expect(validateEmail(email)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1b: Strings without @ are rejected', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => !s.includes('@') && s.length > 0),
        (notEmail) => {
          expect(validateEmail(notEmail)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1c: Empty strings are rejected', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('   ')).toBe(false);
  });

  it('Property 1d: Strings with @ but invalid format are rejected', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 0, maxLength: 10 }),
          fc.string({ minLength: 0, maxLength: 10 })
        ).filter(([local, domain]) => {
          // Filter to invalid formats: missing local, missing domain, or missing TLD
          return local.trim() === '' || domain.trim() === '' || !domain.includes('.');
        }),
        ([local, domain]) => {
          const invalidEmail = `${local}@${domain}`;
          expect(validateEmail(invalidEmail)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1e: Emails with spaces are rejected', () => {
    fc.assert(
      fc.property(
        fc.emailAddress(),
        fc.integer({ min: 0, max: 10 }),
        (email, insertPos) => {
          // Insert a space somewhere in the email
          const pos = insertPos % (email.length + 1);
          const emailWithSpace = email.slice(0, pos) + ' ' + email.slice(pos);
          // Emails with internal spaces should be rejected
          if (emailWithSpace.trim() !== emailWithSpace) {
            // Leading/trailing spaces - our validator trims, so check trimmed version
            expect(validateEmail(emailWithSpace.trim())).toBe(validateEmail(email));
          } else {
            // Internal space - should be rejected
            expect(validateEmail(emailWithSpace)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
