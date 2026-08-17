const API = import.meta.env.VITE_API_URL || '/api'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  failed = 'Request failed',
  signal?: AbortSignal,
): Promise<T> {
  const token = localStorage.getItem('pytrail_token')
  const response = await fetch(`${API}${path}`, {
    ...options,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    let detail = failed
    try {
      const body = await response.json()
      detail = body.detail || failed
    } catch {
      /* The status still carries the failure when no JSON body exists. */
    }
    throw new ApiError(detail, response.status)
  }
  return response.json()
}
