/**
 * Maps Firebase Auth error codes to messages a candidate can act on.
 *
 * Raw Firebase errors ("Firebase: Error (auth/invalid-credential).") are shown
 * verbatim otherwise, which is both confusing and leaks implementation detail.
 *
 * Note on sign-in failures: modern Firebase deliberately returns a single
 * `auth/invalid-credential` for wrong-password *and* unknown-email so an
 * attacker cannot enumerate which addresses have accounts. The copy here keeps
 * that ambiguity rather than guessing which one it was.
 */
const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect email or password. Please check and try again.',
  'auth/wrong-password': 'Incorrect email or password. Please check and try again.',
  'auth/user-not-found': 'Incorrect email or password. Please check and try again.',
  'auth/invalid-email': 'That doesn’t look like a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
  'auth/weak-password': 'Please choose a password of at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes before trying again.',
  'auth/network-request-failed': 'Network problem — please check your connection and try again.',
  'auth/requires-recent-login': 'For security, please sign in again before making this change.',
  'auth/missing-email': 'Please enter your email address.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled. Please contact support.',
  'auth/unauthorized-continue-uri': 'Email link configuration issue. Please contact support.',
};

export function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  return 'Something went wrong. Please try again, or contact support if it continues.';
}
