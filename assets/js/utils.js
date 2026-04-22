export async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Datei konnte nicht geladen werden: ${path}`);
  return response.json();
}

export function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function setCssVariables(config) {
  const root = document.documentElement;
  if (config.primaryColor) root.style.setProperty('--primary', config.primaryColor);
  if (config.secondaryColor) root.style.setProperty('--primary-2', config.secondaryColor);
}

export function getPortalBasePath() {
  const path = window.location.pathname.replace(/index\.html$/, '');
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

export async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

export function showToast() {
  const toast = document.getElementById('copyToast');
  if (!toast) return;
  toast.classList.add('show');
  window.clearTimeout(window.__copyToastTimer);
  window.__copyToastTimer = window.setTimeout(() => toast.classList.remove('show'), 1800);
}
