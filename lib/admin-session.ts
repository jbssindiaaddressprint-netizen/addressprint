// Shared constant for the JBSS admin panel session cookie.
// Unlike tenant sessions, there's a single shared admin password (set via
// ADMIN_PASSWORD env var) and a fixed secret token (ADMIN_SESSION_TOKEN env var)
// used as the cookie value once that password has been verified.

export const ADMIN_SESSION_COOKIE = 'ap_admin_session'
