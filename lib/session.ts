// Shared helpers for the tenant login "session ticket" cookie.
// Format: loginId.tenantId.token  (all three are UUID-like strings, so "." is a safe separator)

export const SESSION_COOKIE = 'ap_session'

export type SessionCookie = {
  loginId: string
  tenantId: string
  token: string
}

export function encodeSession(loginId: string, tenantId: string, token: string): string {
  return `${loginId}.${tenantId}.${token}`
}

export function decodeSession(raw: string | undefined | null): SessionCookie | null {
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length !== 3) return null
  const [loginId, tenantId, token] = parts
  if (!loginId || !tenantId || !token) return null
  return { loginId, tenantId, token }
}
