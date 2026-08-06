import { describe, it, expect } from 'vitest';
import {
  generateOtp, newSalt, hashOtp, verifyOtp, emailKey, normalizeEmail,
  isValidEmail, suggestEmailDomain, passwordChecks, passwordMeetsAll, passwordProblem,
  OTP_LENGTH,
} from './otp';

describe('generateOtp', () => {
  it('always produces exactly OTP_LENGTH digits, zero-padded', () => {
    for (let i = 0; i < 500; i++) {
      expect(generateOtp()).toMatch(new RegExp(`^\\d{${OTP_LENGTH}}$`));
    }
  });

  it('is not obviously biased and does not repeat itself', () => {
    const seen = new Set(Array.from({ length: 300 }, () => generateOtp()));
    // A constant or near-constant generator is the failure worth catching here.
    expect(seen.size).toBeGreaterThan(250);
  });
});

describe('hashOtp / verifyOtp', () => {
  it('never stores the code in readable form', () => {
    const salt = newSalt();
    const hash = hashOtp('123456', salt);
    expect(hash).not.toContain('123456');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accepts the right code and rejects a wrong one', () => {
    const salt = newSalt();
    const hash = hashOtp('123456', salt);
    expect(verifyOtp('123456', salt, hash)).toBe(true);
    expect(verifyOtp('123457', salt, hash)).toBe(false);
  });

  it('salts per record, so the same code hashes differently', () => {
    expect(hashOtp('123456', newSalt())).not.toBe(hashOtp('123456', newSalt()));
  });

  it('returns false rather than throwing on a malformed stored hash', () => {
    // timingSafeEqual throws on a length mismatch; the length guard exists to
    // stop a corrupt record turning into a 500 on the signup path.
    expect(verifyOtp('123456', newSalt(), 'short')).toBe(false);
    expect(verifyOtp('123456', newSalt(), '')).toBe(false);
  });
});

describe('emailKey', () => {
  it('is case- and whitespace-insensitive, and hides the address', () => {
    expect(emailKey(' Aisha@Example.com ')).toBe(emailKey('aisha@example.com'));
    expect(emailKey('aisha@example.com')).not.toContain('aisha');
  });

  it('separates different addresses', () => {
    expect(emailKey('a@example.com')).not.toBe(emailKey('b@example.com'));
  });
});

describe('normalizeEmail', () => {
  it('lower-cases and trims', () => {
    expect(normalizeEmail('  Aisha@Example.COM ')).toBe('aisha@example.com');
  });
});

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    for (const e of ['a@b.co', 'aisha.k@university.edu.in', 'first+tag@gmail.com']) {
      expect(isValidEmail(e)).toBe(true);
    }
  });

  it('rejects malformed ones', () => {
    for (const e of ['', 'a@b', 'no-at-sign.com', 'a..b@example.com', '@example.com', 'a@@b.com']) {
      expect(isValidEmail(e)).toBe(false);
    }
  });

  it('rejects an address beyond the length limit', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@example.com`)).toBe(false);
  });
});

describe('suggestEmailDomain', () => {
  it('catches a mistyped popular provider', () => {
    // A code sent to a typo'd address cannot be recovered by the candidate, and
    // typo domains of big providers are often registered by third parties.
    expect(suggestEmailDomain('aisha@gamil.com')).toBe('aisha@gmail.com');
    expect(suggestEmailDomain('aisha@yahooo.com')).toBe('aisha@yahoo.com');
  });

  it('leaves a correctly spelled provider alone', () => {
    expect(suggestEmailDomain('aisha@gmail.com')).toBeNull();
  });

  it('leaves a genuine institutional domain alone', () => {
    expect(suggestEmailDomain('aisha@iitb.ac.in')).toBeNull();
    expect(suggestEmailDomain('r@mentraedge.com')).toBeNull();
  });

  it('returns null for a malformed address instead of throwing', () => {
    expect(suggestEmailDomain('no-at-sign')).toBeNull();
    expect(suggestEmailDomain('@example.com')).toBeNull();
  });
});

describe('password rules', () => {
  it('agrees between the live checklist and the enforced rule', () => {
    // These are shown to the candidate as they type and enforced on the server.
    // If they ever disagree, the form says a password is fine and the API
    // rejects it after a verification code has already been sent.
    for (const p of ['', 'short1', 'abcdefgh', '12345678', 'abcd1234', 'a'.repeat(200)]) {
      expect(passwordMeetsAll(p)).toBe(passwordProblem(p) === null);
    }
  });

  it('requires 8+ characters with a letter and a number', () => {
    expect(passwordProblem('abcd1234')).toBeNull();
    expect(passwordProblem('abcdefgh')).toMatch(/letter and one number/);
    expect(passwordProblem('12345678')).toMatch(/letter and one number/);
    expect(passwordProblem('abc1')).toMatch(/8 characters/);
  });

  it('rejects an over-long password', () => {
    expect(passwordProblem('a1' + 'x'.repeat(200))).toMatch(/too long/);
  });

  it('rejects a non-string without throwing', () => {
    expect(passwordProblem(undefined as any)).toMatch(/8 characters/);
    expect(passwordChecks(undefined as any)).toEqual({ length: false, letter: false, number: false });
  });
});
