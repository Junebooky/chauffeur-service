export const OPERATOR_EMAIL = 'gotoward7@gmail.com'

export function composeEmail(subject: string, body = '') {
  const params = new URLSearchParams({ subject })
  if (body) params.set('body', body)
  return `mailto:${OPERATOR_EMAIL}?${params.toString()}`
}

export const customQuoteEmail = () =>
  composeEmail('CHAUFFEUR · Custom itinerary inquiry',
    'Hello CHAUFFEUR,\n\nI would like to ask about a custom journey.\n\nDates:\nPickup / destination:\nNumber of guests:\nSpecial requests:\n\nThank you.')
