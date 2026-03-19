"""
SPITFIRE — Azure 연결 진단 + 영문 Signal 번역
================================================
Codespaces 터미널에서 실행:
  python fix_signals.py

.env.local 파일에서 직접 키를 읽어 GitHub Secrets 문제를 우회합니다.
"""

import os
import json
import requests

# ─── .env.local에서 직접 키 읽기 ───
def load_env_local():
    """프로젝트의 .env.local 파일에서 환경변수를 직접 로드."""
    env = {}
    for path in [".env.local", "../.env.local", "/workspaces/spitfire/.env.local"]:
        if os.path.exists(path):
            print(f"📂 .env.local 발견: {os.path.abspath(path)}")
            with open(path) as f:
                for line in f:
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        key, val = line.split("=", 1)
                        env[key.strip()] = val.strip()
            break
    else:
        print("⚠ .env.local 파일을 찾지 못했습니다. 환경변수를 사용합니다.")
    return env

env = load_env_local()

# 환경변수 또는 .env.local에서 가져오기 (모든 공백/줄바꿈 제거)
def get_val(key):
    val = env.get(key) or os.environ.get(key) or ""
    return val.strip().replace("\r", "").replace("\n", "")

AZURE_ENDPOINT = get_val("AZURE_OPENAI_ENDPOINT").rstrip("/")
AZURE_API_KEY = get_val("AZURE_OPENAI_API_KEY")
AZURE_DEPLOYMENT = get_val("AZURE_OPENAI_DEPLOYMENT") or "gpt-5-nano"
SUPABASE_URL = (get_val("SUPABASE_URL") or get_val("NEXT_PUBLIC_SUPABASE_URL")).rstrip("/")
SUPABASE_KEY = get_val("SUPABASE_SERVICE_ROLE_KEY") or get_val("NEXT_PUBLIC_SUPABASE_ANON_KEY")

HEADERS_SB = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

TRANSLATE_PROMPT = """영문 뉴스 헤드라인을 KT 전략적 파트너십 관점에서 분석하세요.
반드시 아래 JSON 형식만 출력 (마크다운/백틱 금지):
{
  "headline_ko": "한글 개조식 요약 (30자 이내)",
  "summary_ko": "KT 관점에서 중요한 이유 1~2문장 한글",
  "target_axis": "strategic_alignment|capability_complementarity|monetization_clarity|execution_readiness|control_dependency|market_access|internal_compatibility|timing_urgency",
  "impact_score": -3에서+3사이정수,
  "event_type": "M&A|Product_Launch|Partnership|Investment|Regulation|Earnings|Other"
}"""


def has_korean(text):
    return any('\uAC00' <= c <= '\uD7A3' for c in (text or ""))


# ════════════════════════════════════════════════════════════
# STEP 1: Azure 연결 진단
# ════════════════════════════════════════════════════════════
def test_azure():
    print("\n" + "=" * 60)
    print("STEP 1: Azure OpenAI 연결 진단")
    print("=" * 60)
    print(f"  Endpoint:   {AZURE_ENDPOINT}")
    print(f"  Deployment: {AZURE_DEPLOYMENT}")
    print(f"  Key length: {len(AZURE_API_KEY)} chars")
    print(f"  Key start:  '{AZURE_API_KEY[:6]}...'")
    print(f"  Key end:    '...{AZURE_API_KEY[-6:]}'")
    
    # 특수문자 체크
    bad_chars = [c for c in AZURE_API_KEY if c in '\r\n\t ']
    if bad_chars:
        print(f"  ❌ 키에 비정상 문자 발견: {repr(bad_chars)}")
        return False
    else:
        print(f"  ✅ 키 형식 정상")

    # 실제 API 호출 테스트
    print("\n  🔄 테스트 호출 중...")
    api_url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version=2024-12-01-preview"
    
    try:
        resp = requests.post(api_url, json={
            "messages": [{"role": "user", "content": "Say 'hello' in Korean. Only output the Korean word."}],
            "max_completion_tokens": 20,
            "temperature": 1,
        }, headers={
            "api-key": AZURE_API_KEY,
            "Content-Type": "application/json",
        }, timeout=15)

        print(f"  HTTP Status: {resp.status_code}")
        
        if resp.ok:
            result = resp.json()["choices"][0]["message"]["content"].strip()
            print(f"  ✅ Azure 응답: '{result}'")
            return True
        else:
            print(f"  ❌ Azure 오류: {resp.text[:200]}")
            
            if resp.status_code == 404:
                print(f"\n  💡 배포명 '{AZURE_DEPLOYMENT}'이 존재하지 않습니다.")
                print(f"     Azure Portal → OpenAI → 배포(Deployments)에서 실제 배포명을 확인하세요.")
            elif resp.status_code == 401:
                print(f"\n  💡 API 키가 유효하지 않습니다. Azure Portal에서 새 키를 발급하세요.")
            return False
    except Exception as e:
        print(f"  ❌ 연결 실패: {e}")
        return False


# ════════════════════════════════════════════════════════════
# STEP 2: Supabase 연결 진단
# ════════════════════════════════════════════════════════════
def test_supabase():
    print("\n" + "=" * 60)
    print("STEP 2: Supabase 연결 진단")
    print("=" * 60)
    print(f"  URL: {SUPABASE_URL}")
    print(f"  Key: {SUPABASE_KEY[:20]}...")
    
    try:
        url = f"{SUPABASE_URL}/rest/v1/organizations?select=name&status=eq.active&limit=3"
        resp = requests.get(url, headers=HEADERS_SB, timeout=10)
        if resp.ok:
            orgs = resp.json()
            print(f"  ✅ {len(orgs)}개 기업 조회 성공: {[o['name'] for o in orgs]}")
            return True
        else:
            print(f"  ❌ 오류: {resp.status_code} {resp.text[:100]}")
            return False
    except Exception as e:
        print(f"  ❌ 연결 실패: {e}")
        return False


# ════════════════════════════════════════════════════════════
# STEP 3: 영문 Signal 번역
# ════════════════════════════════════════════════════════════
def translate_all():
    print("\n" + "=" * 60)
    print("STEP 3: 영문 Signal → 한글 번역")
    print("=" * 60)
    
    # 영문 signals 가져오기
    url = f"{SUPABASE_URL}/rest/v1/signals?select=id,headline,summary,organization_id&order=event_date.desc&limit=200"
    resp = requests.get(url, headers=HEADERS_SB, timeout=15)
    all_signals = resp.json()
    eng_signals = [s for s in all_signals if not has_korean(s.get("headline", ""))]
    
    print(f"  전체 signals: {len(all_signals)}건")
    print(f"  영문 (번역 필요): {len(eng_signals)}건")
    print(f"  한글 (정상): {len(all_signals) - len(eng_signals)}건\n")
    
    if not eng_signals:
        print("  ✅ 번역할 영문 signal이 없습니다!")
        return
    
    # org 이름 캐시
    org_cache = {}
    translated = 0
    failed = 0
    
    for sig in eng_signals:
        oid = sig["organization_id"]
        headline = sig["headline"]
        
        if oid not in org_cache:
            r = requests.get(f"{SUPABASE_URL}/rest/v1/organizations?id=eq.{oid}&select=name&limit=1", headers=HEADERS_SB, timeout=5)
            org_cache[oid] = r.json()[0]["name"] if r.ok and r.json() else "Unknown"
        
        company = org_cache[oid]
        print(f"  [{company}] {headline[:55]}...")
        
        # Azure 번역 호출
        try:
            api_url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version=2024-12-01-preview"
            r = requests.post(api_url, json={
                "messages": [
                    {"role": "system", "content": TRANSLATE_PROMPT},
                    {"role": "user", "content": f"기업: {company}\n헤드라인: {headline}"},
                ],
                "max_completion_tokens": 4096,
                "temperature": 1,
                "response_format": {"type": "json_object"},
            }, headers={
                "api-key": AZURE_API_KEY,
                "Content-Type": "application/json",
            }, timeout=90)
            
            if not r.ok:
                print(f"    ❌ Azure {r.status_code}: {r.text[:80]}")
                failed += 1
                continue
            
            full_resp = r.json()
            ai_text = (full_resp["choices"][0]["message"].get("content") or "").strip()
            if not ai_text:
                reason = full_resp["choices"][0].get("finish_reason", "unknown")
                filt = full_resp["choices"][0].get("content_filter_results", {})
                print(f"    ⚠ 빈 응답. finish_reason={reason}, filter={filt}")
                failed += 1
                continue
            ai_text = ai_text.replace("```json", "").replace("```", "").strip()
            result = json.loads(ai_text)
            
            hk = result.get("headline_ko", "")
            if not has_korean(hk):
                print(f"    ⚠ 한글 없음 — 스킵")
                failed += 1
                continue
            
            # DB 업데이트
            valid_axes = ["strategic_alignment", "capability_complementarity", "monetization_clarity",
                          "execution_readiness", "control_dependency", "market_access",
                          "internal_compatibility", "timing_urgency"]
            
            update = {"headline": hk, "summary": result.get("summary_ko", "")}
            if result.get("target_axis") in valid_axes:
                update["target_axis"] = result["target_axis"]
            if result.get("impact_score") is not None:
                update["impact_score"] = max(-3, min(3, int(result["impact_score"])))
            if result.get("event_type"):
                update["event_type"] = result["event_type"]
            
            patch_url = f"{SUPABASE_URL}/rest/v1/signals?id=eq.{sig['id']}"
            patch_headers = {**HEADERS_SB, "Prefer": "return=minimal"}
            pr = requests.patch(patch_url, json=update, headers=patch_headers, timeout=10)
            
            if pr.ok:
                score = result.get("impact_score", 0)
                print(f"    ✅ → {hk} ({score:+d})")
                translated += 1
            else:
                print(f"    ⚠ DB 업데이트 실패: {pr.status_code}")
                failed += 1
                
        except json.JSONDecodeError:
            print(f"    ⚠ JSON 파싱 실패. 원문 응답:")
            print(f"    >>> {ai_text[:300]}")
            failed += 1
        except Exception as e:
            print(f"    ❌ 오류: {e}")
            failed += 1
    
    print(f"\n  🏁 완료: {translated}건 번역 / {failed}건 실패 / 총 {len(eng_signals)}건")


# ════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════
def main():
    print("🔥 SPITFIRE — Signal 진단 + 번역 도구")
    print("=" * 60)
    
    # Step 1: Azure 테스트
    azure_ok = test_azure()
    
    # Step 2: Supabase 테스트
    supabase_ok = test_supabase()
    
    if not azure_ok:
        print("\n❌ Azure 연결 실패. 위 오류를 해결한 뒤 다시 실행하세요.")
        print("\n💡 확인할 것:")
        print("   1. Azure Portal → OpenAI → 배포 이름이 '{0}'인지 확인".format(AZURE_DEPLOYMENT))
        print("   2. .env.local의 AZURE_OPENAI_API_KEY가 정확한지 확인")
        print("   3. .env.local의 AZURE_OPENAI_ENDPOINT가 정확한지 확인")
        return
    
    if not supabase_ok:
        print("\n❌ Supabase 연결 실패.")
        return
    
    # Step 3: 번역 실행
    translate_all()
    
    print("\n✅ 완료. 브라우저에서 SPITFIRE를 새로고침하세요.")


if __name__ == "__main__":
    main()
