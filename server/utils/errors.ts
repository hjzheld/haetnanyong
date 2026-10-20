export function apiError(statusCode: number, code: string, message: string, details?: Record<string, unknown>) {
  throw createError({ statusCode, data: { code, message, details } })
}

export function notImplemented(resource: string) {
  return createError({
    statusCode: 501,
    statusMessage: `${resource} API is not implemented yet`,
    data: { code: 'NOT_IMPLEMENTED', resource },
  })
}
