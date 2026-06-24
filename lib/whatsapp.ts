// Shared helper for sending WhatsApp template messages via Meta's Cloud API,
// using the JBSS WABA (+91 90879 15330).
// Requires WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to be set as environment variables.

const GRAPH_VERSION = 'v21.0'

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  bodyParams: string[],
  opts: { languageCode?: string; buttonCode?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  const { languageCode = 'en', buttonCode } = opts
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    const missing = [!token && 'WHATSAPP_ACCESS_TOKEN', !phoneNumberId && 'WHATSAPP_PHONE_NUMBER_ID']
      .filter(Boolean)
      .join(', ')
    return { success: false, error: `Missing env var(s): ${missing}` }
  }

  // The Cloud API expects digits only (country code + number, no +, spaces, or dashes).
  const toDigits = to.replace(/\D/g, '')
  if (!toDigits) {
    return { success: false, error: 'No valid phone number to send to.' }
  }

  const components = bodyParams.length
    ? [
        {
          type: 'body',
          parameters: bodyParams.map((text) => ({ type: 'text', text })),
        },
      ]
    : []

  // Authentication templates with an OTP "copy code" button require the same code
  // to appear a second time, in a separate button component — Meta rejects/ignores
  // the message without it. Only Authentication-category templates need this.
  if (buttonCode) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: buttonCode }],
    } as unknown as { type: string; parameters: { type: string; text: string }[] })
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toDigits,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      return { success: false, error: `WhatsApp error: ${errBody}` }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown WhatsApp error' }
  }
}
