export const MESSAGES = {
  // Auth
  SIGNUP_SUCCESS: 'Account created successfully',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logged out successfully',
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_EXISTS: 'Email already registered',
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Access denied',
  TOKEN_INVALID: 'Invalid or expired token',

  // Validation
  VALIDATION_ERROR: 'Validation failed',

  // Extractions
  EXTRACTION_STARTED: 'Extraction started',
  EXTRACTION_SUCCESS: 'Extraction completed successfully',
  EXTRACTION_NOT_FOUND: 'Extraction not found',
  NO_API_KEY: 'Please configure your Anthropic API key in Settings before processing PDFs',
  PDF_REQUIRED: 'PDF file is required',
  PDF_TOO_LARGE: 'PDF file exceeds the 50 MB limit',

  // Settings
  SETTINGS_UPDATED: 'Settings updated successfully',
  SETTINGS_FETCHED: 'Settings fetched successfully',

  // Generic
  NOT_FOUND: 'Resource not found',
  SERVER_ERROR: 'Internal server error',
  RATE_LIMITED: 'Too many requests, please try again later',
} as const;
