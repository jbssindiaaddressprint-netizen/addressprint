// Shared helper for sending transactional emails via Brevo.
// Requires BREVO_API_KEY to be set as an environment variable.

const SENDER_EMAIL = 'support@jbssindia.com'
const SENDER_NAME = 'JBSS AddressPrint'

export async function sendBrevoEmail(to: string, subject: string, htmlContent: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    return { success: false, error: 'BREVO_API_KEY is not configured.' }
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      return { success: false, error: `Brevo error: ${errBody}` }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown email error' }
  }
}
