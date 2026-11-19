/**
 * Chat safety and content moderation scanner
 * Checks for phone number harvesting, off-platform payment circumvention, and abusive words.
 */

const OFF_PLATFORM_PAYMENT_PATTERNS = [
  /\b(gpay|phonepe|paytm|upi|bhim|paypal|venmo)\b/i,
  /\b(pay\s+offline|pay\s+outside|transfer\s+directly|cash\s+only|bypass\s+app)\b/i,
  /\b[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}\b/i, // UPI IDs like name@okaxis
];

const PHONE_NUMBER_PATTERN = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10}\b/;

const BLOCKED_WORDS = [
  'scam',
  'fraud',
  'fake ride',
  'abuse',
  'idiot',
  'harass',
];

export interface SafetyScanResult {
  safe: boolean;
  flaggedReason?: string;
  sanitizedContent: string;
}

export function scanMessageSafety(content: string): SafetyScanResult {
  const trimmed = content.trim();

  // 1. Check for phone number scraping
  if (PHONE_NUMBER_PATTERN.test(trimmed)) {
    return {
      safe: false,
      flaggedReason: 'Sharing personal phone numbers directly in chat is restricted for safety. Use in-app calling or chat.',
      sanitizedContent: trimmed.replace(PHONE_NUMBER_PATTERN, '[Phone Number Protected]'),
    };
  }

  // 2. Check for off-platform payment attempts
  for (const pattern of OFF_PLATFORM_PAYMENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        safe: false,
        flaggedReason: 'Off-platform payment arrangements (UPI/GPay/Cash bypass) violate safety policies. All fares must stay protected within GoTogether.',
        sanitizedContent: trimmed,
      };
    }
  }

  // 3. Check for abusive language
  const lower = trimmed.toLowerCase();
  for (const word of BLOCKED_WORDS) {
    if (lower.includes(word)) {
      return {
        safe: false,
        flaggedReason: 'Message contains prohibited language or harassment keywords.',
        sanitizedContent: trimmed,
      };
    }
  }

  return {
    safe: true,
    sanitizedContent: trimmed,
  };
}
