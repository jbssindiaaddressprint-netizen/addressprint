export type AdminTenant = {
  id: string
  name: string
  slug: string
  email: string | null
  phone: string
  is_active: boolean
  customer_limit: number
  paid_logins: number
  prints_month: number
  prints_lifetime: number
}
