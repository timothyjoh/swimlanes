export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function apiCall<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });

    const json = await response.json();

    if (!response.ok) {
      return { success: false, error: json.error || 'Request failed' };
    }

    return { success: true, data: json.data };

  } catch (error) {
    return { success: false, error: 'Network error. Please try again.' };
  }
}
