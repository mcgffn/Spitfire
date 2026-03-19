"""
TINA Signal Engine v2 — News Ingestion & AI Classification
============================================================
기존 TINA 엔진의 강점(경량화 + 한글 개조식 요약)을 유지하면서
SPITFIRE의 8축 분류 + KT 파트너십 관점을 추가한 버전.

Pipeline:
  1. Supabase에서 active organizations 목록 조회
  2. NewsAPI로 각 기업의 최근 48시간 영문 뉴스 수집
  3. Azure OpenAI (gpt-5-nano)로:
     - 영문 헤드라인 → 한글 개조식 요약 번역
     - 8축 분류 + impact_score + KT relevance 판정
     - event_type 분류
  4. Supabase signals 테이블에 INSERT (원문 URL 보존)
  5. freshness_bucket 자동 갱신

GitHub Actions: 매일 KST 07:00 자동 실행
수동 실행: workflow_dispatch

환경변수 (GitHub Secrets):
  - NEWS_API_KEY
  - AZURE_OPENAI_ENDPOINT
  - AZURE_OPENAI_API_KEY
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
"""

import os
import json
import requests
from datetime import datetime, timedelta, timezone

# ─── Config (strip ALL whitespace/newlines/carriage returns from secrets) ───
def _clean(val):
    """Remove any whitespace, newlines, carriage returns from env value."""
    return (val or "").strip().replace("\r", "").replace("\n", "").replace(" ", "") if val else ""

def _clean_url(val):
    """Clean URL but preserve internal structure."""
    return (val or "").strip().replace("\r", "").replace("\n", "").rstrip("/")

NEWS_API_KEY = _clean(os.environ.get("NEWS_API_KEY"))
AZURE_ENDPOINT = _clean_url(os.environ.get("AZURE_OPENAI_ENDPOINT"))
AZURE_API_KEY = _clean(os.environ.get("AZURE_OPENAI_API_KEY"))
AZURE_DEPLOYMENT = _clean(os.environ.get("AZURE_OPENAI_DEPLOYMENT")) or "gpt-5-nano"
SUPABASE_URL = _clean_url(os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "")
SUPABASE_KEY = _clean(os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY"))

HEADERS_SB = {
    "apikey": SUPABASE_KEY or "",
    "Authorization": f"Bearer {SUPABASE_KEY or ''}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

VALID_AXES = [
    "strategic_alignment", "capability_complementarity", "monetization_clarity",
    "execution_readiness", "control_dependency", "market_access",
    "internal_compatibility", "timing_urgency",
]

# ─── TINA-style AI prompt: 한글 개조식 요약 + 8축 분류 ───
SYSTEM_PROMPT = """당신은 KT의 전략적 파트너십 분석가입니다.
KT의 핵심 자산: KT Cloud AIDC(AI 데이터센터), B2B/B2G 기업 채널, IPTV/소비자 유통, 소버린 AI 인프라 전략.

아래 영문 뉴스 기사를 분석하여 JSON으로 응답하세요. 반드시 아래 형식만 출력하세요.

{
  "headline_ko": "한글 개조식 요약 (30자 이내, 핵심만)",
  "summary_ko": "KT 파트너십 관점에서 이 뉴스가 왜 중요한지 1~2문장 한글 설명",
  "target_axis": "8축 중 가장 관련된 축 key",
  "impact_score": 정수(-3~+3),
  "kt_relevance_score": 소수(0~10),
  "event_type": "M&A|Product_Launch|Partnership|Investment|Regulation|Earnings|Scandal|Restructuring|Other"
}

8축 기준:
- strategic_alignment: KT 전략 방향과의 일치도
- capability_complementarity: 상호 역량 보완
- monetization_clarity: 수익화 가시성
- execution_readiness: 실행 준비도
- control_dependency: 종속/통제 리스크 (부정적 뉴스는 음수)
- market_access: 시장/채널 접근 가치
- internal_compatibility: 조직 적합성
- timing_urgency: 타이밍 긴급성

impact_score 기준:
+3: KT 파트너십에 매우 긍정적
+1/+2: 다소 긍정적
0: 중립 (KT와 직접 관련 없음)
-1/-2: 다소 부정적
-3: 매우 부정적

JSON만 출력하세요. 마크다운이나 백틱 금지."""


def get_organizations():
    url = f"{SUPABASE_URL}/rest/v1/organizations?status=eq.active&select=id,name,ticker"
    resp = requests.get(url, headers=HEADERS_SB, timeout=10)
    resp.raise_for_status()
    return resp.json()


def get_existing_urls(org_id: str) -> set:
    url = f"{SUPABASE_URL}/rest/v1/signals?organization_id=eq.{org_id}&select=source_url&limit=200"
    try:
        resp = requests.get(url, headers=HEADERS_SB, timeout=10)
        return {r["source_url"] for r in resp.json() if r.get("source_url")} if resp.ok else set()
    except:
        return set()


def fetch_news(company_name: str, ticker: str = None, hours_back: int = 48) -> list:
    if not NEWS_API_KEY:
        print(f"  ⚠ NEWS_API_KEY 미설정 — {company_name} 스킵")
        return []

    from_dt = (datetime.now(timezone.utc) - timedelta(hours=hours_back)).strftime("%Y-%m-%dT%H:%M:%SZ")
    query = f'"{company_name}"'
    if ticker:
        query = f'"{company_name}" OR "{ticker}"'

    try:
        resp = requests.get("https://newsapi.org/v2/everything", params={
            "q": query, "from": from_dt, "language": "en",
            "sortBy": "relevancy", "pageSize": 10, "apiKey": NEWS_API_KEY,
        }, timeout=15)
        resp.raise_for_status()
        articles = resp.json().get("articles", [])
        # Filter out [Removed] articles from NewsAPI
        articles = [a for a in articles if a.get("title") and "[Removed]" not in a["title"]]
        # ── 날짜 필터: 7일 이내 기사만 ──
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
        before_filter = len(articles)
        articles = [a for a in articles if (a.get("publishedAt") or "") >= cutoff]
        if before_filter != len(articles):
            print(f"  🗓 {before_filter - len(articles)}건 7일 이전 기사 제외")
        print(f"  📰 {company_name}: {len(articles)}건 수집")
        return articles
    except Exception as e:
        print(f"  ❌ NewsAPI 오류 ({company_name}): {e}")
        return []


def has_korean(text: str) -> bool:
    """텍스트에 한글이 포함되어 있는지 확인."""
    return any('\uAC00' <= c <= '\uD7A3' for c in text)


def translate_headline(company_name: str, title: str) -> str:
    """분류 실패 시 번역만 시도하는 경량 호출."""
    if not AZURE_ENDPOINT or not AZURE_API_KEY:
        return ""
    try:
        api_url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version=2024-12-01-preview"
        resp = requests.post(api_url, json={
            "messages": [
                {"role": "system", "content": "영문 뉴스 헤드라인을 한글로 번역하세요. 30자 이내 개조식으로. 번역문만 출력."},
                {"role": "user", "content": f"기업: {company_name}\n헤드라인: {title}"},
            ],
            "max_tokens": 100,
            "temperature": 0.1,
        }, headers={
            "api-key": AZURE_API_KEY,
            "Content-Type": "application/json",
        }, timeout=20)
        if resp.ok:
            translated = resp.json()["choices"][0]["message"]["content"].strip()
            if has_korean(translated):
                return translated
    except:
        pass
    return ""


def classify_article(company_name: str, article: dict) -> dict | None:
    """Azure OpenAI로 뉴스 분류 + 한글 번역. 실패 시 번역만 시도. 둘 다 실패하면 None."""
    title = article.get("title", "")
    desc = article.get("description", "") or ""
    url = article.get("url", "")
    published = article.get("publishedAt", "")

    if not AZURE_ENDPOINT or not AZURE_API_KEY:
        print(f"    ⏭ AI 미설정 — 스킵: {title[:50]}")
        return None

    user_msg = f"기업: {company_name}\n헤드라인: {title}\n설명: {desc[:300]}"

    try:
        api_url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version=2024-12-01-preview"
        resp = requests.post(api_url, json={
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            "max_tokens": 300,
            "temperature": 0.1,
        }, headers={
            "api-key": AZURE_API_KEY,
            "Content-Type": "application/json",
        }, timeout=30)

        if not resp.ok:
            print(f"    ⚠ Azure API 오류 {resp.status_code}: {resp.text[:120]}")
            # Fallback: 번역만 시도
            translated = translate_headline(company_name, title)
            if translated:
                print(f"    🔄 번역 fallback 성공: {translated[:40]}")
                return {
                    "headline_ko": translated,
                    "summary_ko": f"{company_name} 관련 최신 동향.",
                    "target_axis": "strategic_alignment",
                    "impact_score": 0,
                    "kt_relevance_score": 3.0,
                    "event_type": "Other",
                    "source_url": url,
                    "published_at": published,
                    "original_headline": title,
                }
            print(f"    ❌ 번역도 실패 — 스킵: {title[:50]}")
            return None

        resp.raise_for_status()
        ai_text = resp.json()["choices"][0]["message"]["content"].strip()
        ai_text = ai_text.replace("```json", "").replace("```", "").strip()
        result = json.loads(ai_text)

        # Validate & clamp
        if result.get("target_axis") not in VALID_AXES:
            result["target_axis"] = "strategic_alignment"
        result["impact_score"] = max(-3, min(3, int(result.get("impact_score", 0))))
        result["kt_relevance_score"] = max(0, min(10, float(result.get("kt_relevance_score", 5))))

        # 한글 번역 검증
        headline_ko = result.get("headline_ko", "")
        if not has_korean(headline_ko):
            # 분류는 성공했지만 번역이 안 된 경우 — 번역만 재시도
            translated = translate_headline(company_name, title)
            if translated:
                result["headline_ko"] = translated
                print(f"    🔄 번역 보완: {translated[:40]}")
            else:
                print(f"    ⚠ 한글 번역 실패 — 스킵: {title[:50]}")
                return None

        result["source_url"] = url
        result["published_at"] = published
        result["original_headline"] = title

        print(f"    ✅ {result['headline_ko'][:40]}... → {result['target_axis']} ({result['impact_score']:+d})")
        return result

    except json.JSONDecodeError as e:
        print(f"    ⚠ JSON 파싱 실패: {e}")
        # JSON 파싱 실패해도 번역은 시도
        translated = translate_headline(company_name, title)
        if translated:
            return {
                "headline_ko": translated,
                "summary_ko": f"{company_name} 관련 최신 동향.",
                "target_axis": "strategic_alignment",
                "impact_score": 0,
                "kt_relevance_score": 3.0,
                "event_type": "Other",
                "source_url": url,
                "published_at": published,
                "original_headline": title,
            }
        return None
    except Exception as e:
        print(f"    ❌ AI 분류 실패 — 스킵: {e}")
        return None


def insert_signals(org_id: str, classified: list, existing_urls: set) -> int:
    inserted = 0
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%d")
    for item in classified:
        src_url = item.get("source_url", "")
        if src_url in existing_urls:
            continue

        event_date = None
        if item.get("published_at"):
            try:
                event_date = item["published_at"][:10]
            except:
                pass
        if not event_date:
            event_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # ── 14일 이전 기사는 저장하지 않음 ──
        if event_date < cutoff_date:
            continue

        # Evidence quality from source domain
        if any(d in src_url for d in [".gov", "ir.", "investor.", "sec.gov", "newsroom"]):
            eq = "official"
        elif any(d in src_url for d in ["reuters.com", "bloomberg.com", "wsj.com", "ft.com", "techcrunch.com"]):
            eq = "news"
        else:
            eq = "news"

        signal = {
            "organization_id": org_id,
            "source_url": src_url,
            "headline": item.get("headline_ko", item.get("original_headline", ""))[:500],
            "event_type": item.get("event_type", "Other"),
            "event_date": event_date,
            "target_axis": item["target_axis"],
            "impact_score": item["impact_score"],
            "kt_relevance_score": item.get("kt_relevance_score", 5.0),
            "summary": item.get("summary_ko", "")[:1000],
            "evidence_quality": eq,
            "freshness_bucket": "7d",
        }

        try:
            resp = requests.post(
                f"{SUPABASE_URL}/rest/v1/signals",
                json=signal, headers=HEADERS_SB, timeout=10
            )
            if resp.status_code in (200, 201):
                inserted += 1
            else:
                print(f"    ⚠ INSERT 실패: {resp.status_code} {resp.text[:80]}")
        except Exception as e:
            print(f"    ❌ INSERT 오류: {e}")

    return inserted


def refresh_freshness():
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/refresh_signal_freshness",
            json={}, headers=HEADERS_SB, timeout=10
        )
        print(f"{'✅' if resp.ok else '⚠'} Freshness 갱신 완료")
    except:
        pass


def main():
    print("🔥 TINA Signal Engine v2 — 수집 시작")
    print(f"   Supabase: {'✅' if SUPABASE_URL else '❌'}")
    print(f"   NewsAPI:  {'✅' if NEWS_API_KEY else '❌'}")
    print(f"   Azure AI: {'✅ ' + AZURE_DEPLOYMENT if AZURE_API_KEY else '⚠ 폴백'}")
    print(f"   Endpoint: {AZURE_ENDPOINT[:50]}..." if AZURE_ENDPOINT else "   Endpoint: ❌")
    print(f"   Key len:  {len(AZURE_API_KEY)} chars, starts='{AZURE_API_KEY[:4]}', ends='{AZURE_API_KEY[-4:]}'")
    print()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요")
        return

    orgs = get_organizations()
    print(f"📋 대상 기업: {len(orgs)}개\n")

    total = 0
    for org in orgs:
        oid, name, ticker = org["id"], org["name"], org.get("ticker")
        print(f"── {name} {'(' + ticker + ')' if ticker else ''} ──")

        existing = get_existing_urls(oid)
        articles = fetch_news(name, ticker, hours_back=48)

        if not articles:
            print(f"  ⏭ 새 기사 없음\n")
            continue

        classified = [c for c in (classify_article(name, a) for a in articles) if c is not None]
        if not classified:
            print(f"  ⏭ AI 번역 성공한 기사 없음\n")
            continue
        n = insert_signals(oid, classified, existing)
        total += n
        print(f"  📥 {n}건 신규 저장\n")

    refresh_freshness()
    print(f"🏁 완료. 총 {total}건 신규 신호 저장.")


if __name__ == "__main__":
    main()
