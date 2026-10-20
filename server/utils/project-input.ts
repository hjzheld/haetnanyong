export function validateProjectInput(value: unknown, creating = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: 'A JSON request body is required' })
  }
  const input = value as Record<string, unknown>
  for (const field of ['name', 'description', 'color']) {
    if (input[field] !== undefined && typeof input[field] !== 'string') {
      throw createError({ statusCode: 400, statusMessage: `${field} must be a string` })
    }
  }
  if ((creating || input.name !== undefined) && !String(input.name ?? '').trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Project name is required' })
  }
  if (typeof input.name === 'string' && [...input.name.trim()].length > 150) throw createError({ statusCode: 400, statusMessage: 'Project name exceeds 150 characters' })
  if (input.color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(String(input.color).trim())) {
    throw createError({ statusCode: 400, statusMessage: 'Color must be a 6-digit hex value such as #557558' })
  }
  if (input.archived !== undefined && typeof input.archived !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'archived must be a boolean' })
  }
  if (!creating && !['name', 'description', 'color', 'archived'].some(key => input[key] !== undefined)) {
    throw createError({ statusCode: 400, statusMessage: 'At least one project field is required' })
  }
  return input as { name?: string; description?: string; color?: string; archived?: boolean }
}
