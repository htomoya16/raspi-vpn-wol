export class ApiError extends Error {
  constructor(status, detail, rawDetail) {
    super(detail || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail || '';
    this.rawDetail = rawDetail;
  }
}

function normalizeDetail(detail) {
  if (detail == null) {
    return '';
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object' && 'msg' in item) {
          return String(item.msg);
        }
        return JSON.stringify(item);
      })
      .join(', ');
  }
  if (typeof detail === 'object') {
    if ('msg' in detail) {
      return String(detail.msg);
    }
    return JSON.stringify(detail);
  }
  return String(detail);
}

export function formatApiError(error) {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : '通信に失敗しました';
  }

  if (error.status === 400) {
    return `リクエストエラー: ${error.detail}`;
  }
  if (error.status === 404) {
    return `対象が見つかりません: ${error.detail}`;
  }
  if (error.status === 422) {
    return `入力形式エラー: ${error.detail}`;
  }
  return `HTTP ${error.status}: ${error.detail}`;
}

export async function request(path, options = {}) {
  const res = await fetch(path, options);
  const contentType = res.headers.get('content-type') || '';

  let data = null;
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    const text = await res.text();
    data = text ? { detail: text } : null;
  }

  if (!res.ok) {
    const rawDetail = data && typeof data === 'object' ? data.detail : null;
    const detail = normalizeDetail(rawDetail) || `HTTP ${res.status}`;
    throw new ApiError(res.status, detail, rawDetail);
  }

  return data;
}
