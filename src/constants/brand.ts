/**
 * Brand and legal-entity names, in one place.
 *
 * These were previously typed out ~50 times across the Terms, Privacy,
 * Disclaimer and Refund pages as "FinExamsEdge EdTech Private Limited". Renaming
 * meant a find-and-replace through legal text that users agree to at checkout,
 * with no way to be sure every occurrence matched.
 *
 * LEGAL_ENTITY is the name that contracts with the customer and appears on the
 * tax invoice, set here to the value confirmed by the client. Note it carries no
 * incorporation suffix ("Private Limited", "LLP"). If MentraEdge is a registered
 * company, the full registered name belongs here — an Indian tax invoice must
 * carry the seller's registered name to be claimable by the buyer, and the
 * governing-law clause names a specific entity in a specific jurisdiction.
 * Changing this one constant updates all four legal pages.
 */

/** Consumer-facing product name. */
export const PRODUCT = 'MyExams365';

/** Trading/brand name of the business behind the product. */
export const COMPANY = 'MentraEdge';

/** The entity named in contracts and on invoices. Confirmed by the client. */
export const LEGAL_ENTITY = 'MyExams365 by MentraEdge';

/**
 * Contact mailboxes shown to candidates.
 *
 * Each of these MUST be a mailbox someone actually reads. The grievance address
 * in particular is a statutory contact under the DPDP Act, 2023 — publishing one
 * that bounces is a compliance problem, not just a broken link. They previously
 * pointed at finexamsedge.com, a domain this product no longer uses.
 */
export const SUPPORT_EMAIL = 'support@myexams365.com';
export const PRIVACY_EMAIL = 'privacy@myexams365.com';
export const GRIEVANCE_EMAIL = 'grievance@myexams365.com';

/**
 * The one contact number published anywhere on the site.
 *
 * Two values for one number, because the visible text and the tel: link had
 * drifted apart before: the site showed a mobile on /contact and a landline on
 * the home page, and printed the landline itself two different ways. Both are
 * derived here so a card cannot dial something other than what it displays.
 *
 * Anything that shows a phone number MUST read it from here.
 */
export const SUPPORT_PHONE = '+91 4446367250';
export const SUPPORT_PHONE_TEL = 'tel:+914446367250';

/** Courts named in the governing-law clause. */
export const JURISDICTION = 'Chennai, Tamil Nadu';
