export function inputBody(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw createError({ statusCode: 400, statusMessage: 'JSON object body is required' })
  return value as Record<string, any>
}
export function inputId(value: unknown): string {
  const id = String(value ?? '')
  if (!/^[1-9]\d*$/.test(id) || BigInt(id) > BigInt('9223372036854775807')) throw createError({ statusCode: 400, statusMessage: 'Invalid numeric ID' })
  return id
}
export function inputText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw createError({ statusCode: 400, statusMessage: `${field} must be a non-empty string` })
  const max = field === 'title' ? 200 : field === 'email' ? 254 : undefined
  if (max && [...value.trim()].length > max) throw createError({ statusCode: 400, statusMessage: `${field} exceeds ${max} characters` })
  return value.trim()
}
export function inputPassword(value: unknown): string {
  if (typeof value !== 'string' || !value.length) throw createError({ statusCode: 400, statusMessage: 'password must be a non-empty string' })
  return value
}
export function inputDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw createError({ statusCode: 400, statusMessage: `${field} must be a valid YYYY-MM-DD date` })
  return value
}
export function inputTime(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw createError({ statusCode: 400, statusMessage: `${field} must be an ISO timestamp with timezone` })
  return value
}
export function inputEnum(value: unknown, allowed: string[], field: string) {
  if (typeof value !== 'string' || !allowed.includes(value)) throw createError({ statusCode: 400, statusMessage: `Invalid ${field}` })
  return value
}
export function inputDescription(value: unknown) {
  if (value !== null && typeof value !== 'string') throw createError({ statusCode: 400, statusMessage: 'description must be a string or null' })
  return value
}
