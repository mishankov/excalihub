export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await res
    .json()
    .catch(() => ({ error: 'Unable to reach the server.' }));
  if (!res.ok)
    throw new ApiError(
      res.status,
      (data as { error?: string }).error || 'Request failed.',
    );
  return data as T;
}
