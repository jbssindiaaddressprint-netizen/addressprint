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
  subscription_status: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  subscription_amount: number | null
  plan_key: string | null
  gst_number: string | null
  billing_company_name: string | null
  active_extra_logins: number
}
