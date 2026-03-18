"""
TINA Signal Engine — News Ingestion & AI Classification
=========================================================
GitHub Actions에서 매일 KST 07:00에 실행됩니다.

Pipeline:
  1. Supabase에서 active organizations 목록 조회
  2. NewsAPI로 각 기업의 최근 48시간 뉴스 수집
  3. Azure OpenAI (gpt-5-nano)로 8축 분류 + impact_score + KT relevance 판정
  4. Supabase signals 테이블에 INSERT
  5. freshness_bucket 자동 갱신

필요한 환경변수 (GitHub Secrets):
  - NEWS_API_KEY
  - AZURE_OPENAI_ENDPOINT
  - AZURE_OPENAI_API_KEY
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY (not anon — 서버 사이드 쓰기용)
"""

import os
import json
import requests
from datetime import datetime, timedelta, timezone

# ─── Config ───
NEWS_API_KEY = os.environ.get("NEWS_API_KEY")
AZURE_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
AZURE_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY")
AZURE_DEPLOYMENT = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-5-nano")
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

HEADERS_SUPABASE = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

# 8 evaluation axes
VALID_AXES = [
    "strategic_alignment", "capability_complementarity", "monetization_clarity",
    "execution_readiness", "control_dependency", "market_access",
    "internal_compatibility", "timing_urgency",
]

# KT partnership context for AI classification
KT_CONTEXT = """You are a strategic partnership analyst for KT Corporation, a major South Korean telecom and cloud company.
KT's key assets: KT Cloud AIDC (AI datacenter), B2B/B2G enterprise channels, IPTV/consumer distribution, sovereign AI infrastructure ambitions.

Your job: Classify news articles about KT's potential partner companies across 8 strategic axes.
For each article, determine:
1. target_axis: Which of the 8 axes does this news most impact?
   - strategic_alignment: Does this affect strategic fit with KT?
   - capability_complementarity: Does this change mutual capability gaps?
   - monetization_clarity: Does this affect revenue potential?
   - execution_readiness: Does this change partnership execution feasibility?
   - control_dependency: Does this affect dependency/control risk? (negative = more dependency)
   - market_access: Does this change market/channel access value?
   - internal_compatibility: Does this affect organizational fit?
   - timing_urgency: Does this change the urgency to act?

2. impact_score: Integer from -3 to +3
   - +3: Very positive for KT partnership
   - +1/+2: Moderately positive
   - 0: Neutral
   - -1/-2: Moderately negative
   - -3: Very negative for KT partnership

3. kt_relevance_score: Float 0-10, how directly relevant is this to KT specifically?

4. summary: 1-2 sentence Korean summary of why this matters for KT partnership.

5. event_type: One of: M&A, Product_Launch, Partnership, Investment, Regulation, Earnings, Scandal, Restructuring, Other

Respond ONLY with valid JSON. No markdown, no backticks."""


def get_organizations():
    """Fetch active organizations from Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/organizations?status=eq.active&select=id,name,ticker"
    resp = requests.get(url, headers=HEADERS_SUPABASE)
    resp.raise_for_status()
    return resp.json()


def get_existing_urls(org_id: str) -> set:
    """Get already-ingested source URLs to avoid duplicates."""
    url = f"{SUPABASE_URL}/rest/v1/signals?organization_id=eq.{org_id}&select=source_url"
    resp = requests.get(url, headers=HEADERS_SUPABASE)
    if resp.status_code == 200:
        return {r["source_url"] for r in resp.json() if r.get("source_url")}
    return set()


def fetch_news(company_name: str, ticker: str = None, hours_back: int = 48) -> list:
    """Fetch recent news from NewsAPI."""
    if not NEWS_API_KEY:
        print(f"  ⚠ NEWS_API_KEY not set, skipping news fetch for {company_name}")
        return []

    from_date = (datetime.now(timezone.utc) - timedelta(hours=hours_back)).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Build query: company name + optional ticker
    query = company_name
    if ticker:
        query = f'"{company_name}" OR "{ticker}"'

    params = {
        "q": query,
        "from": from_date,
        "language": "en",
        "sortBy": "relevancy",
        "pageSize": 10,
        "apiKey": NEWS_API_KEY,
    }

    try:
        resp = requests.get("https://newsapi.org/v2/everything", params=params, timeout=15)
        resp.raise_for_status()
        articles = resp.json().get("articles", [])
        print(f"  📰 {len(articles)} articles found for {company_name}")
        return articles
    except Exception as e:
        print(f"  ❌ NewsAPI error for {company_name}: {e}")
        return []


def classify_with_ai(company_name: str, articles: list) -> list:
    """Send articles to Azure OpenAI for 8-axis classification."""
    if not AZURE_ENDPOINT or not AZURE_API_KEY:
        print("  ⚠ Azure OpenAI not configured, using basic classification")
        return basic_classify(articles)

    results = []
    for article in articles:
        title = article.get("title", "")
        description = article.get("description", "") or ""
        content_snippet = (article.get("content", "") or "")[:500]

        user_prompt = f"""Company: {company_name}
Headline: {title}
Description: {description}
Content: {content_snippet}

Classify this article for KT partnership impact. Respond with JSON only:
{{"target_axis": "...", "impact_score": 0, "kt_relevance_score": 0.0, "summary": "...", "event_type": "..."}}"""

        try:
            # Azure OpenAI Responses API
            url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version=2024-12-01-preview"
            payload = {
                "messages": [
                    {"role": "system", "content": KT_CONTEXT},
                    {"role": "user", "content": user_prompt},
                ],
                "max_tokens": 300,
                "temperature": 0.2,
            }
            headers = {
                "api-key": AZURE_API_KEY,
                "Content-Type": "application/json",
            }

            resp = requests.post(url, json=payload, headers=headers, timeout=30)
            resp.raise_for_status()

            ai_text = resp.json()["choices"][0]["message"]["content"].strip()
            # Clean potential markdown fences
            ai_text = ai_text.replace("```json", "").replace("```", "").strip()
            classification = json.loads(ai_text)

            # Validate
            if classification.get("target_axis") not in VALID_AXES:
                classification["target_axis"] = "strategic_alignment"
            classification["impact_score"] = max(-3, min(3, int(classification.get("impact_score", 0))))
            classification["kt_relevance_score"] = max(0, min(10, float(classification.get("kt_relevance_score", 5))))

            results.append({
                "headline": title,
                "source_url": article.get("url", ""),
                "published_at": article.get("publishedAt", ""),
                **classification,
            })
            print(f"    ✅ {title[:60]}... → {classification['target_axis']} ({classification['impact_score']:+d})")

        except Exception as e:
            print(f"    ❌ AI classification failed: {e}")
            # Fallback to basic
            results.append({
                "headline": title,
                "source_url": article.get("url", ""),
                "published_at": article.get("publishedAt", ""),
                "target_axis": "strategic_alignment",
                "impact_score": 0,
                "kt_relevance_score": 5.0,
                "summary": f"{company_name} 관련 뉴스: {title}",
                "event_type": "Other",
            })

    return results


def basic_classify(articles: list) -> list:
    """Fallback classification without AI."""
    return [{
        "headline": a.get("title", ""),
        "source_url": a.get("url", ""),
        "published_at": a.get("publishedAt", ""),
        "target_axis": "strategic_alignment",
        "impact_score": 0,
        "kt_relevance_score": 5.0,
        "summary": a.get("description", "") or a.get("title", ""),
        "event_type": "Other",
    } for a in articles]


def insert_signals(org_id: str, classified: list, existing_urls: set):
    """Insert classified signals into Supabase."""
    inserted = 0
    for item in classified:
        if item["source_url"] in existing_urls:
            continue  # Skip duplicates

        # Determine event_date from publishedAt
        event_date = None
        if item.get("published_at"):
            try:
                event_date = item["published_at"][:10]  # YYYY-MM-DD
            except:
                event_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        else:
            event_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Determine evidence quality
        source_url = item.get("source_url", "")
        if any(d in source_url for d in [".gov", "ir.", "investor.", "sec.gov", "newsroom"]):
            evidence_quality = "official"
        elif any(d in source_url for d in ["reuters.com", "bloomberg.com", "wsj.com", "ft.com"]):
            evidence_quality = "news"
        elif any(d in source_url for d in ["analyst", "research"]):
            evidence_quality = "analyst"
        else:
            evidence_quality = "news"

        signal = {
            "organization_id": org_id,
            "source_url": source_url,
            "headline": item["headline"][:500],
            "event_type": item.get("event_type", "Other"),
            "event_date": event_date,
            "target_axis": item["target_axis"],
            "impact_score": item["impact_score"],
            "kt_relevance_score": item.get("kt_relevance_score", 5.0),
            "summary": (item.get("summary", "") or "")[:1000],
            "evidence_quality": evidence_quality,
            "freshness_bucket": "7d",
        }

        try:
            url = f"{SUPABASE_URL}/rest/v1/signals"
            resp = requests.post(url, json=signal, headers=HEADERS_SUPABASE)
            if resp.status_code in (200, 201):
                inserted += 1
            else:
                print(f"    ⚠ Insert failed: {resp.status_code} {resp.text[:100]}")
        except Exception as e:
            print(f"    ❌ Insert error: {e}")

    return inserted


def refresh_freshness():
    """Call the freshness refresh function in Supabase."""
    try:
        url = f"{SUPABASE_URL}/rest/v1/rpc/refresh_signal_freshness"
        resp = requests.post(url, json={}, headers=HEADERS_SUPABASE)
        if resp.status_code == 200:
            print("✅ Freshness buckets updated")
        else:
            print(f"⚠ Freshness refresh: {resp.status_code}")
    except Exception as e:
        print(f"⚠ Freshness refresh error: {e}")


def main():
    print("🔥 TINA Signal Engine — Starting ingestion")
    print(f"   Supabase: {'✅ configured' if SUPABASE_URL else '❌ missing'}")
    print(f"   NewsAPI: {'✅ configured' if NEWS_API_KEY else '❌ missing'}")
    print(f"   Azure OpenAI: {'✅ configured' if AZURE_API_KEY else '⚠ fallback mode'}")
    print()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
        return

    # 1. Get target companies
    orgs = get_organizations()
    print(f"📋 {len(orgs)} target companies loaded")
    print()

    total_inserted = 0

    for org in orgs:
        org_id = org["id"]
        name = org["name"]
        ticker = org.get("ticker")

        print(f"── {name} {'(' + ticker + ')' if ticker else ''} ──")

        # 2. Get existing URLs to avoid duplicates
        existing = get_existing_urls(org_id)

        # 3. Fetch news
        articles = fetch_news(name, ticker, hours_back=48)

        if not articles:
            print(f"  ⏭ No new articles")
            print()
            continue

        # 4. AI classification
        classified = classify_with_ai(name, articles)

        # 5. Insert into Supabase
        inserted = insert_signals(org_id, classified, existing)
        total_inserted += inserted
        print(f"  📥 {inserted} new signals inserted")
        print()

    # 6. Refresh freshness buckets for all signals
    refresh_freshness()

    print(f"🏁 Done. Total new signals: {total_inserted}")


if __name__ == "__main__":
    main()
