const key = (slug: string) => `portal_session:${slug}`;

export function getPortalSession(slug: string) {
  try {
    const v = localStorage.getItem(key(slug));
    if (!v) return null;
    const parsed = JSON.parse(v);
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export function setPortalSession(slug: string, token: string) {
  localStorage.setItem(key(slug), JSON.stringify({ token }));
}

export function clearPortalSession(slug: string) {
  localStorage.removeItem(key(slug));
}
