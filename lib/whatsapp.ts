// Shared helper for sending WhatsApp template messages via Meta's Cloud API,
// using the JBSS WABA (+91 90879 15330).
// Requires WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to be set as environment variables.

const GRAPH_VERSION = 'v21.0'

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  bodyParams: string[],
  languageCode: string = 'en'
): Promise<{ success: boolean; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    return { success: false, error: 'WhatsApp credentials are not configured.' }
  }

  // The Cloud API expects digits only (country code + number, no +, spaces, or dashes).
  const toDigits = to.replace(/\D/g, '')
  if (!toDigits) {
    return { success: false, error: 'No valid phone number to send to.' }
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
          components: bodyParams.length
            ? [
                {
                  type: 'body',
                  parameters: bodyParams.map((text) => ({ type: 'text', text })),
                },
              ]
            : [],
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
