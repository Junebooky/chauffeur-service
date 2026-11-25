export const OPERATOR_EMAIL = 'gotoward7@gmail.com'

export function composeEmail(subject: string, body = '') {
  const params = new URLSearchParams({ subject })
  if (body) params.set('body', body)
  return `mailto:${OPERATOR_EMAIL}?${params.toString()}`
}

// Let the customer write their own subject and message for custom enquiries.
export const customQuoteEmail = () => `mailto:${OPERATOR_EMAIL}`
