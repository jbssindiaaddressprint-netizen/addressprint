export type ContactPerson = {
  name: string
  phone: string
  is_default: boolean
}

export type Customer = {
  id: string
  tenant_id: string
  company_name: string
  address: string
  pin: string
  state: string
  country: string
  contacts: ContactPerson[]
}

export type TransporterType = 'transporter' | 'courier'

export type Transporter = {
  id: string
  tenant_id: string
  type: TransporterType
  name: string
  branch: string
  mode: string | null
  freight: string | null
  lr: string | null
}

export type Tenant = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  address: string
  pin: string
  state: string
  country: string
  phone: string
  email: string | null
  extra_phones: string[] | null
  prints_month: number
  prints_lifetime: number
  subscription_status?: string | null
  trial_ends_at?: string | null
  current_period_end?: string | null
}

export type LabelSize = 'A4' | 'A5' | 'A6' | 'A7' | 'DL Env' | 'C5 Env' | 'C4 Env'
export type CareSymbol = 'Fragile' | 'Glass' | 'Keep Dry' | 'This Side Up' | 'Do Not Bend'

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string }
