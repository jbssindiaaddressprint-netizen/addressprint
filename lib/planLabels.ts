// Friendly labels for the plan_key values saved on tenants at Subscribe time.
// Shared between the admin panel and the payment webhook's notify emails so
// both show the exact same plan name.
export const PLAN_LABELS: Record<string, string> = {
  base_monthly: 'Monthly',
  base_3month: '3-Month',
  base_6month: '6-Month',
  base_yearly: 'Yearly',
}

export function planLabel(planKey: string | null | undefined): string {
  if (!planKey) return 'Unknown plan'
  return PLAN_LABELS[planKey] ?? planKey
}
