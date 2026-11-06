export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(path, {
      signal: controller.signal,
      method: method || (body === undefined ? "GET" : "POST"),
      credentials: "same-origin",
      cache: "no-store",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok)
      throw new ApiError(response.status, data?.error || "request_failed");
    if (!data) throw new ApiError(502, "invalid_response");
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}
export function errorMessage(error: unknown) {
  if (!(error instanceof ApiError))
    return "Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.";
  if (error.status === 401)
    return "Сессия завершилась. Войдите снова, чтобы продолжить.";
  if (error.status === 404)
    return "Предложение недоступно. Возможно, доступ был изменён.";
  if (error.status === 409)
    return "Документ изменился в другой вкладке. Ваши правки сохранены на этом экране.";
  if (error.status === 503)
    return "Рабочее пространство временно недоступно. Попробуйте позже.";
  if (error.status === 413)
    return "В предложении слишком много содержимого для одного сохранения.";
  return "Не удалось выполнить действие. Проверьте данные и попробуйте ещё раз.";
}
