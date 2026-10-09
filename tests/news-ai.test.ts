import test from 'node:test';
import assert from 'node:assert/strict';
import { translateAndExplainNews } from '../lib/news-ai';

test('news AI returns validated Khmer copy and a non-advisory market explanation', async t => {
  const env = { ...process.env };
  const originalFetch = globalThis.fetch;
  const translated = {
    title: 'ចំណងជើងជាភាសាខ្មែរ',
    summary: 'សេចក្តីសង្ខេបជាភាសាខ្មែរ',
    body: 'អត្ថបទជាភាសាខ្មែរ',
    marketImpactKm: 'ព័ត៌មាននេះអាចប៉ះពាល់ដល់រូបិយប័ណ្ណ ប្រសិនបើការរំពឹងទុកអំពីអត្រាការប្រាក់ផ្លាស់ប្តូរ។ នេះមិនមែនជាការណែនាំជួញដូរទេ។',
  };
  const captured: { requestBody?: Record<string, unknown> } = {};
  process.env.OPENAI_API_KEY = 'fixture-only-key';
  process.env.OPENAI_MODEL = 'gpt-4o-mini';
  globalThis.fetch = (async (_input, init) => {
    captured.requestBody = JSON.parse(String(init?.body));
    return Response.json({
      id: 'fixture', object: 'chat.completion', created: 0, model: 'gpt-4o-mini',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(translated) } }],
    });
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; process.env = env; });

  const result = await translateAndExplainNews({ title: 'Rate decision', summary: 'The central bank held rates.', body: 'The decision was announced today.' });
  assert.deepEqual(result, translated);
  assert.equal(captured.requestBody?.model, 'gpt-4o-mini');
  assert.equal(captured.requestBody?.max_completion_tokens, 8000);
  assert.equal('max_tokens' in (captured.requestBody || {}), false);
  assert.equal((captured.requestBody?.response_format as { json_schema?: { strict?: boolean } }).json_schema?.strict, true);
});

test('news AI rejects oversized or empty source text before making a request', async () => {
  const env = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'fixture-only-key';
  try {
    await assert.rejects(translateAndExplainNews({ title: ' ', summary: 'Summary', body: 'Body' }), /INVALID_NEWS_TEXT/);
    await assert.rejects(translateAndExplainNews({ title: 'Title', summary: 'Summary', body: 'x'.repeat(12001) }), /INVALID_NEWS_TEXT/);
  } finally {
    if (env === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = env;
  }
});
