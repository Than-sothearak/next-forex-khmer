import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/lib/mongodb';
import { translateAndExplainNews } from '@/lib/news-ai';
import { requireAdmin } from '@/lib/admin';
import News from '@/models/News';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await connectMongo();
    const requested = Number(request.nextUrl.searchParams.get('limit') || 12);
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(requested, 100)) : 12;
    const items = await News.find({ status: 'published' })
      .select('title slug summary body titleEn summaryEn bodyEn source sourceUrl category impact marketImpactKm publishedAt')
      .sort({ publishedAt: -1 }).limit(limit).lean();
    return NextResponse.json(items, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[news-api] GET failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      mongodbConfigured: Boolean(process.env.MONGODB_URI),
    });
    return NextResponse.json({ error: 'Could not load news' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    await connectMongo();
    const data: unknown = await request.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return NextResponse.json({ error: 'INVALID_NEWS' }, { status: 400 });
    }
    const row = data as Record<string, unknown>;
    const titleEn = typeof row.titleEn === 'string' ? row.titleEn : row.title;
    const summaryEn = typeof row.summaryEn === 'string' ? row.summaryEn : row.summary;
    const bodyEn = typeof row.bodyEn === 'string' ? row.bodyEn : row.body;
    if (typeof titleEn !== 'string' || typeof summaryEn !== 'string' || typeof bodyEn !== 'string') {
      return NextResponse.json({ error: 'TITLE_SUMMARY_BODY_REQUIRED' }, { status: 400 });
    }
    const impact = row.impact ?? 'medium';
    if (!['high', 'medium', 'low'].includes(String(impact))) {
      return NextResponse.json({ error: 'INVALID_IMPACT' }, { status: 400 });
    }
    const source = typeof row.source === 'string' ? row.source.trim().slice(0, 200) : undefined;
    const sourceUrl = typeof row.sourceUrl === 'string' ? row.sourceUrl : undefined;
    const publishedAt = row.publishedAt ? new Date(String(row.publishedAt)) : new Date();
    if (!Number.isFinite(publishedAt.getTime())) return NextResponse.json({ error: 'INVALID_PUBLISHED_AT' }, { status: 400 });
    if (sourceUrl) {
      try { if (!['http:', 'https:'].includes(new URL(sourceUrl).protocol)) throw new Error(); }
      catch { return NextResponse.json({ error: 'INVALID_SOURCE_URL' }, { status: 400 }); }
    }
    const providedSlug = typeof row.slug === 'string' ? row.slug.trim().toLowerCase() : '';
    const slug = (providedSlug || titleEn.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `news-${createHash('sha256').update(titleEn).digest('hex').slice(0, 12)}`).slice(0, 180);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json({ error: 'INVALID_SLUG' }, { status: 400 });
    }
    if (await News.exists({ slug })) return NextResponse.json({ error: 'NEWS_ALREADY_EXISTS' }, { status: 409 });

    const translated = await translateAndExplainNews({ title: titleEn, summary: summaryEn, body: bodyEn });
    const item = await News.create({
      title: translated.title, summary: translated.summary, body: translated.body,
      titleEn, summaryEn, bodyEn, marketImpactKm: translated.marketImpactKm,
      slug, source, sourceUrl, category: typeof row.category === 'string' ? row.category.slice(0, 100) : 'Market',
      impact, publishedAt, status: row.status === 'draft' ? 'draft' : 'published',
    });
    return NextResponse.json(item, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const detail = error && typeof error === 'object' ? error as { status?: unknown; code?: unknown } : {};
    console.warn('News publish failed', {
      status: typeof detail.status === 'number' ? detail.status : null,
      code: typeof detail.code === 'string' ? detail.code : error instanceof Error ? error.message : null,
    });
    const message = error instanceof Error ? error.message : '';
    const status = message === 'OPENAI_NOT_CONFIGURED' ? 503 : message === 'INVALID_NEWS_TEXT' ? 400 : 502;
    return NextResponse.json({ error: status === 503 ? 'OPENAI_NOT_CONFIGURED' : status === 400 ? 'INVALID_NEWS_TEXT' : 'NEWS_AI_UNAVAILABLE' }, { status });
  }
}
