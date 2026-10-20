export function useApi() {
  const request = <T>(url: string, options?: Parameters<typeof $fetch<T>>[1]) =>
    $fetch<T>(url, options)

  return { request }
}
