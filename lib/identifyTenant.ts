import { supabaseAdmin } from './supabase'

export type IdentifiedTenant = {
  id: string
  slug: string
  name: string
  email: string | null
  phone: string
  is_active: boolean
}

// Accepts either an email address or a mobile number (any formatting — spaces,
// dashes, +91, etc. are all stripped before matching the last 10 digits).
// Returns every matching active tenant — a handful of old test accounts share
// one phone number, so this can legitimately return more than one row.
export async function findTenantsByIdentifier(identifierRaw: string): Promise<IdentifiedTenant[]> {
  const identifier = identifierRaw.trim()
  if (!identifier) return []

  if (identifier.includes('@')) {
    const { data } = await supabaseAdmin
      .from('tenants')
      .select('id, slug, name, email, phone, is_active')
      .ilike('email', identifier.toLowerCase())
    return (data ?? []).filter((t) => t.is_active !== false) as IdentifiedTenant[]
  }

  const digits = identifier.replace(/\D/g, '').slice(-10)
  if (digits.length < 10) return []

  const { data } = await supabaseAdmin
    .from('tenants')
    .select('id, slug, name, email, phone, is_active')
    .ilike('phone', `%${digits}`)
  return (data ?? []).filter((t) => t.is_active !== false) as IdentifiedTenant[]
}
