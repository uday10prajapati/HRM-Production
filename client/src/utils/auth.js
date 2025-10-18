export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

export function isAuthenticated() {
  return !!getCurrentUser();
}

export function hasRole(role) {
  const u = getCurrentUser();
  if (!u || !u.role) return false;
  return (''+u.role).toLowerCase() === (''+role).toLowerCase();
}
