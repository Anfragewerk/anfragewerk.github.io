function json(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function getCorsOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
  if (!origin) return '*';
  if (!allowed.length) return '*';
  return allowed.includes(origin) ? origin : 'null';
}

function isValidSlug(slug) {
  return /^[a-z0-9-]+$/i.test(slug || '');
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }
  const message = (payload?.output || []).find(item => item.type === 'message');
  const content = (message?.content || []).find(part => part.type === 'output_text');
  return content?.text || '';
}

function buildPrompt({ config, knowledge, formData }) {
  const lines = [];
  lines.push(`Du arbeitest für ${config.businessName}.`);
  lines.push('');
  lines.push('## Ziel');
  lines.push('Erstelle eine praxistaugliche Antwort für einen Handwerksbetrieb.');
  lines.push('');
  lines.push('## Betriebskontext');
  lines.push(`Systemname: ${config.systemName}`);
  lines.push(`Region: ${config.region}`);
  lines.push(`Leistungen: ${knowledge.services.join(', ')}`);
  lines.push(`Sprachstil: ${knowledge.styleRules.join(', ')}`);
  lines.push(`Geschäftsregeln: ${knowledge.businessRules.join(' | ')}`);
  lines.push(`No-Gos: ${knowledge.noGos.join(' | ')}`);
  lines.push(`Wichtige Qualifizierungspunkte: ${knowledge.qualificationPoints.join(', ')}`);
  lines.push('');
  lines.push('## Aktuelle Anfrage');
  lines.push(`Anfragetyp: ${formData.inquiryType}`);
  lines.push(`Kontaktweg: ${formData.contactChannel}`);
  lines.push(`Dringlichkeit: ${formData.urgency}`);
  lines.push(`Ziel des Outputs: ${formData.outputGoal}`);
  lines.push(`Ton: ${formData.tone}`);
  lines.push(`Projektort: ${formData.projectLocation || 'nicht angegeben'}`);
  lines.push(`Terminwunsch: ${formData.desiredTimeline || 'nicht angegeben'}`);
  lines.push(`Fotos vorhanden: ${formData.photosAvailable || 'Unbekannt'}`);
  if (formData.internalNote && formData.internalNote.trim()) {
    lines.push(`Interner Hinweis: ${formData.internalNote.trim()}`);
  }
  lines.push('Kundenanfrage:');
  lines.push(formData.customerInquiry.trim());
  lines.push('');
  lines.push('## Regeln für die Ausgabe');
  lines.push('- Keine Fakten erfinden.');
  lines.push('- Keine festen Preise nennen, wenn Informationen fehlen.');
  lines.push('- Kurz, klar, professionell und alltagstauglich formulieren.');
  lines.push('- Bei Unsicherheit aktiv fehlende Informationen anfordern.');
  lines.push('- Die Formulierungen sollen nach echtem Handwerksbetrieb klingen, nicht nach Werbetext.');
  return lines.join('\n');
}

function buildSchema() {
  return {
    type: 'object',
    properties: {
      customerReply: {
        type: 'string',
        description: 'Fertige Antwort an den Kunden in einem professionellen, freundlichen Ton.'
      },
      followUpQuestions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Sinnvolle Rückfragen, wenn Informationen fehlen.'
      },
      quoteBase: {
        type: 'array',
        items: { type: 'string' },
        description: 'Interne Stichpunkte für die Angebotsvorbereitung.'
      },
      nextStep: {
        type: 'string',
        description: 'Empfohlener nächster Schritt für den Betrieb.'
      }
    },
    required: ['customerReply', 'followUpQuestions', 'quoteBase', 'nextStep'],
    additionalProperties: false
  };
}

async function loadCustomerData(slug, env) {
  const baseUrl = (env.FRONTEND_BASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) throw new Error('FRONTEND_BASE_URL fehlt.');

  const urls = {
    config: `${baseUrl}/${slug}/config.json`,
    knowledge: `${baseUrl}/${slug}/business-knowledge.json`
  };

  const [configRes, knowledgeRes] = await Promise.all([
    fetch(urls.config, { cf: { cacheTtl: 300, cacheEverything: true } }),
    fetch(urls.knowledge, { cf: { cacheTtl: 300, cacheEverything: true } })
  ]);

  if (!configRes.ok) throw new Error(`config.json für ${slug} konnte nicht geladen werden.`);
  if (!knowledgeRes.ok) throw new Error(`business-knowledge.json für ${slug} konnte nicht geladen werden.`);

  return {
    config: await configRes.json(),
    knowledge: await knowledgeRes.json()
  };
}

export default {
  async fetch(request, env) {
    const origin = getCorsOrigin(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({ ok: true, model: env.OPENAI_MODEL || 'gpt-5.4' }, 200, origin);
    }

    if (url.pathname !== '/api/generate' || request.method !== 'POST') {
      return json({ error: 'Not found' }, 404, origin);
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: 'OPENAI_API_KEY fehlt im Worker.' }, 500, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Ungültiger JSON-Body.' }, 400, origin);
    }

    const { slug, formData } = body || {};
    if (!isValidSlug(slug)) {
      return json({ error: 'Ungültiger slug.' }, 400, origin);
    }
    if (!formData?.customerInquiry || !formData.customerInquiry.trim()) {
      return json({ error: 'Kundenanfrage fehlt.' }, 400, origin);
    }

    try {
      const { config, knowledge } = await loadCustomerData(slug, env);
      const prompt = buildPrompt({ config, knowledge, formData });

      const apiResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || 'gpt-5.4',
          store: false,
          input: [
            {
              role: 'system',
              content: 'Du bist ein KI-Assistent für lokale Handwerksbetriebe. Du formulierst nur das, was aus den vorliegenden Informationen ableitbar ist.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'handwerk_response',
              schema: buildSchema(),
              strict: true
            }
          }
        })
      });

      const payload = await apiResponse.json();
      if (!apiResponse.ok) {
        return json({ error: payload?.error?.message || 'OpenAI-Request fehlgeschlagen.' }, 500, origin);
      }

      const outputText = extractOutputText(payload);
      if (!outputText) {
        return json({ error: 'Keine Ausgabe vom Modell erhalten.' }, 500, origin);
      }

      let parsed;
      try {
        parsed = JSON.parse(outputText);
      } catch {
        return json({ error: 'Die Modellantwort war kein parsebares JSON.', raw: outputText }, 500, origin);
      }

      return json({
        ok: true,
        slug,
        data: parsed,
        meta: {
          model: env.OPENAI_MODEL || 'gpt-5.4',
          systemName: config.systemName,
          generatedAt: new Date().toISOString()
        }
      }, 200, origin);
    } catch (error) {
      return json({ error: error.message || 'Unbekannter Fehler.' }, 500, origin);
    }
  }
};
