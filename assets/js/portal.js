import { fetchJson, setCssVariables, getPortalBasePath, copyText, showToast, escapeHtml } from './utils.js';

const state = {
  config: null,
  knowledge: null,
  cases: null,
  uiText: null,
  slug: '',
  lastResult: null
};

function $(id) {
  return document.getElementById(id);
}

function getSlugFromPath() {
  const path = window.location.pathname.replace(/index\.html$/, '').replace(/^\/+|\/+$/g, '');
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'beispiel';
}

function renderHeader() {
  document.title = `${state.config.systemName} – AnfrageWerk`;
  $('systemName').textContent = state.config.systemName;
  $('businessName').textContent = state.config.businessName;
  $('tagline').textContent = state.config.tagline;
  $('regionPill').textContent = state.config.region;
  $('portalTitle').textContent = state.uiText.heroTitle;
  $('portalText').textContent = state.uiText.heroText;

  const logoBadge = document.querySelector('.logo-badge');
  if (logoBadge) logoBadge.textContent = (state.config.systemName || 'AW').slice(0, 2).toUpperCase();

  $('privacyHint').textContent = state.uiText.privacyHint;
  $('knowledgeTitle').textContent = state.uiText.knowledgeTitle;
  $('outputTitle').textContent = state.uiText.outputTitle;
  $('submitBtn').textContent = state.uiText.submitLabel;
  $('resetBtn').textContent = state.uiText.resetLabel;
  $('exampleBtn').textContent = state.uiText.exampleLabel;
}

function renderFormOptions() {
  for (const type of state.config.inquiryTypes) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    $('inquiryType').append(option);
  }

  for (const channel of state.config.contactChannels) {
    const option = document.createElement('option');
    option.value = channel;
    option.textContent = channel;
    $('contactChannel').append(option);
  }
}

function renderKnowledge() {
  $('servicesList').innerHTML = state.knowledge.services.map(item => `<li>${escapeHtml(item)}</li>`).join('');
  $('styleRulesList').innerHTML = state.knowledge.styleRules.map(item => `<li>${escapeHtml(item)}</li>`).join('');
  $('businessRulesList').innerHTML = state.knowledge.businessRules.map(item => `<li>${escapeHtml(item)}</li>`).join('');
  $('noGosList').innerHTML = state.knowledge.noGos.map(item => `<li>${escapeHtml(item)}</li>`).join('');
  $('qualificationList').innerHTML = state.knowledge.qualificationPoints.map(item => `<li>${escapeHtml(item)}</li>`).join('');
}

function loadExample(index = 0) {
  const example = state.cases.examples[index];
  if (!example) return;

  $('inquiryType').value = example.type || state.config.inquiryTypes[0];
  $('customerInquiry').value = example.inquiry || '';
  $('contactChannel').value = example.contactChannel || state.config.contactChannels[0];
  $('urgency').value = example.urgency || 'Normal';
  $('tone').value = example.tone || 'Freundlich & professionell';
  $('projectLocation').value = example.projectLocation || '';
  $('desiredTimeline').value = example.desiredTimeline || '';
  $('photosAvailable').value = example.photosAvailable || 'Unbekannt';
  $('internalNote').value = example.internalNote || '';
}

function getFormData() {
  return {
    inquiryType: $('inquiryType').value,
    contactChannel: $('contactChannel').value,
    urgency: $('urgency').value,
    tone: $('tone').value,
    customerInquiry: $('customerInquiry').value,
    projectLocation: $('projectLocation').value,
    desiredTimeline: $('desiredTimeline').value,
    photosAvailable: $('photosAvailable').value,
    internalNote: $('internalNote').value
  };
}

function renderMeta(formData) {
  $('metaType').textContent = formData.inquiryType || '–';
  $('metaContext').textContent = [
    formData.contactChannel,
    formData.urgency,
    formData.projectLocation || 'Ort offen'
  ].filter(Boolean).join(' · ');
}

function showLoading() {
  $('loadingCard').classList.remove('hidden');
  $('resultCard').classList.add('hidden');
  $('errorCard').classList.add('hidden');
}

function hideLoading() {
  $('loadingCard').classList.add('hidden');
}

function showError(message) {
  hideLoading();
  $('errorMessage').textContent = message;
  $('errorCard').classList.remove('hidden');
}

function formatParagraphs(text = '') {
  return escapeHtml(text).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
}

function renderResult(data, formData) {
  state.lastResult = data;

  $('customerReplyOutput').innerHTML = `<p>${formatParagraphs(data.customerReply)}</p>`;
  $('followUpQuestionsOutput').innerHTML = (data.followUpQuestions || [])
    .map(item => `<li>${escapeHtml(item)}</li>`)
    .join('');
  $('quoteBaseOutput').innerHTML = (data.quoteBase || [])
    .map(item => `<li>${escapeHtml(item)}</li>`)
    .join('');
  $('nextStepOutput').textContent = data.nextStep || '–';

  renderMeta(formData);
  hideLoading();
  $('errorCard').classList.add('hidden');
  $('resultCard').classList.remove('hidden');
}

function buildCopyText(type = 'all') {
  if (!state.lastResult) return '';

  if (type === 'reply') return state.lastResult.customerReply || '';
  if (type === 'questions') {
    return (state.lastResult.followUpQuestions || []).map((q, i) => `${i + 1}. ${q}`).join('\n');
  }
  if (type === 'quote') {
    return (state.lastResult.quoteBase || []).map(item => `- ${item}`).join('\n');
  }

  return [
    'Antwort an den Kunden',
    state.lastResult.customerReply || '',
    '',
    'Sinnvolle Rückfragen',
    ...(state.lastResult.followUpQuestions || []).map((q, i) => `${i + 1}. ${q}`),
    '',
    'Interne Angebotsbasis',
    ...(state.lastResult.quoteBase || []).map(item => `- ${item}`),
    '',
    `Nächster Schritt: ${state.lastResult.nextStep || ''}`
  ].join('\n');
}

async function handleCopy(type = 'all') {
  const text = buildCopyText(type);
  if (!text) return;
  await copyText(text);
  showToast();
}

async function generateAnswer() {
  const formData = getFormData();

  if (!formData.customerInquiry.trim()) {
    showError('Bitte zuerst eine Kundenanfrage eingeben.');
    return;
  }

  showLoading();

  try {
    const response = await fetch(`${state.config.apiBaseUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: state.slug, formData })
    });

    const payload = await response.json();

    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'Die Generierung ist fehlgeschlagen.');
    }

    renderResult(payload.data, formData);
  } catch (error) {
    showError(error.message || 'Die Generierung ist fehlgeschlagen.');
  }
}

function resetForm() {
  $('portalForm').reset();
  $('resultCard').classList.add('hidden');
  $('errorCard').classList.add('hidden');
  $('loadingCard').classList.add('hidden');
  state.lastResult = null;
}

async function init() {
  const base = getPortalBasePath();
  state.slug = getSlugFromPath();

  const [config, knowledge, cases, uiText] = await Promise.all([
    fetchJson(`${base}/config.json`),
    fetchJson(`${base}/business-knowledge.json`),
    fetchJson(`${base}/cases.json`),
    fetchJson(`${base}/ui-text.json`)
  ]);

  state.config = config;
  state.knowledge = knowledge;
  state.cases = cases;
  state.uiText = uiText;

  setCssVariables(config);
  renderHeader();
  renderFormOptions();
  renderKnowledge();
  loadExample(0);

  $('portalForm').addEventListener('submit', (event) => {
    event.preventDefault();
    generateAnswer();
  });

  $('resetBtn').addEventListener('click', resetForm);
  $('exampleBtn').addEventListener('click', () => loadExample(0));
  $('copyReplyBtn').addEventListener('click', () => handleCopy('reply'));
  $('copyReplyInlineBtn').addEventListener('click', () => handleCopy('reply'));
  $('copyQuestionsBtn').addEventListener('click', () => handleCopy('questions'));
  $('copyQuoteBtn').addEventListener('click', () => handleCopy('quote'));
  $('copyAllBtn').addEventListener('click', () => handleCopy('all'));
}

init().catch((error) => {
  console.error(error);
  $('portalTitle').textContent = 'Fehler beim Laden des Portals';
  $('portalText').textContent = 'Bitte prüfen, ob alle JSON-Dateien vorhanden sind und korrekt geladen werden.';
});
