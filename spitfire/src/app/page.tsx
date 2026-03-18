"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from "recharts";
import {
  Shield, TrendingUp, AlertTriangle, ChevronDown, ChevronUp,
  Eye, Ban, Search, MessageSquare, RotateCcw, Users, Clock,
  ArrowRight, Activity, Loader2, RefreshCw, Database, UserCircle,
} from "lucide-react";
import { useSpitfireData } from "@/lib/hooks/useSpitfireData";
import type { AxisScoreData, Signal } from "@/lib/supabase/types";

// ─── Design Tokens ───
const TEAL = "#00A39B";
const TEAL_LIGHT = "#00C4BB";
const TEAL_DARK = "#007A74";
const RED = "#E54D53";
const RED_LIGHT = "#FF6B70";

const STANCE_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  Deepen:  { color: TEAL,      bg: "rgba(0,163,155,0.12)", icon: TrendingUp, label: "Deepen" },
  Explore: { color: TEAL_LIGHT, bg: "rgba(0,196,187,0.10)", icon: Search,     label: "Explore" },
  Monitor: { color: "#F59E0B",  bg: "rgba(245,158,11,0.10)", icon: Eye,       label: "Monitor" },
  Defend:  { color: "#F97316",  bg: "rgba(249,115,22,0.10)", icon: Shield,    label: "Defend" },
  Avoid:   { color: RED,        bg: "rgba(229,77,83,0.10)", icon: Ban,        label: "Avoid" },
};

// ─── Glass Neumorphism ───
const glass = {
  card: {
    background: "rgba(255,255,255,0.60)",
    backdropFilter: "blur(40px) saturate(1.6)",
    WebkitBackdropFilter: "blur(40px) saturate(1.6)",
    border: "1px solid rgba(255,255,255,0.70)",
    borderRadius: "20px",
    boxShadow: "10px 10px 28px rgba(0,0,0,0.06), -6px -6px 18px rgba(255,255,255,0.9), inset 0 1.5px 0 rgba(255,255,255,0.85)",
  },
  cardInner: {
    background: "rgba(255,255,255,0.40)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.50)",
    borderRadius: "14px",
    boxShadow: "5px 5px 14px rgba(0,0,0,0.035), -3px -3px 10px rgba(255,255,255,0.75), inset 0 1px 0 rgba(255,255,255,0.70)",
  },
  pressed: {
    background: "rgba(236,239,243,0.55)",
    borderRadius: "12px",
    boxShadow: "inset 4px 4px 10px rgba(0,0,0,0.07), inset -3px -3px 8px rgba(255,255,255,0.65)",
    border: "1px solid rgba(210,215,225,0.35)",
  },
  button: {
    background: "rgba(255,255,255,0.60)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.70)",
    borderRadius: "12px",
    boxShadow: "5px 5px 12px rgba(0,0,0,0.05), -3px -3px 8px rgba(255,255,255,0.85)",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
};

// ─── [1] Flame Logo SVG — Enhanced 3D Glassmorphism ───
function SpitfireLogo({ size = 42 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: "drop-shadow(0px 4px 6px rgba(0, 163, 155, 0.4))" }}>
      <defs>
        <linearGradient id="flame-base" x1="50" y1="0" x2="50" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2DD4BF" /><stop offset="40%" stopColor="#00A39B" /><stop offset="100%" stopColor="#005C57" />
        </linearGradient>
        <linearGradient id="glass-edge" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" /><stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.1" /><stop offset="100%" stopColor="#00A39B" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="tooth-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" /><stop offset="100%" stopColor="#2DD4BF" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <path d="M32 18 C38 32 42 28 47 22 C49 15 50 8 50 8 C50 8 53 20 60 25 C65 29 70 20 75 16 C75 16 71 30 76 38 C83 50 90 60 85 80 C80 100 50 100 50 100 C50 100 20 100 15 80 C10 60 17 50 24 38 C29 30 25 16 25 16 C30 20 35 29 32 18 Z" fill="url(#flame-base)" />
      <path d="M32 18 C38 32 42 28 47 22 C49 15 50 8 50 8 C50 8 53 20 60 25 C65 29 70 20 75 16 C75 16 71 30 76 38 C83 50 90 60 85 80 C80 100 50 100 50 100 C50 100 20 100 15 80 C10 60 17 50 24 38 C29 30 25 16 25 16 C30 20 35 29 32 18 Z" fill="none" stroke="url(#glass-edge)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M34 22 C39 34 43 31 47 26 C49 21 50 15 50 15 C50 15 53 24 59 28 C63 31 67 24 71 21 C71 21 68 32 73 39 C79 50 85 59 81 78 C77 95 50 96 50 96 C50 96 23 95 19 78 C15 59 21 50 27 39 C32 32 29 21 29 21 C33 24 37 31 34 22 Z" fill="none" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.5" />
      <path d="M26 50 Q 36 44 43 51 Q 36 54 26 50 Z" fill="#003D3A" opacity="0.8" />
      <path d="M74 50 Q 64 44 57 51 Q 64 54 74 50 Z" fill="#003D3A" opacity="0.8" />
      <path d="M28 49.5 Q 36 45 41 50" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M72 49.5 Q 64 45 59 50" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 66 Q 50 96 84 66 Q 50 80 16 66 Z" fill="#003D3A" opacity="0.6" stroke="#007A74" strokeWidth="1.5" />
      <g stroke="#FFFFFF" strokeWidth="0.8">
        <polygon points="17,67 24,69 23,80" fill="url(#tooth-grad)" />
        <polygon points="24,69 33,72 31,86" fill="url(#tooth-grad)" />
        <polygon points="33,72 42,74 41,89" fill="url(#tooth-grad)" />
        <polygon points="42,74 50,75 46,92" fill="url(#tooth-grad)" />
        <polygon points="50,75 58,74 54,92" fill="url(#tooth-grad)" />
        <polygon points="58,74 67,72 61,89" fill="url(#tooth-grad)" />
        <polygon points="67,72 76,69 69,86" fill="url(#tooth-grad)" />
        <polygon points="76,69 83,67 77,80" fill="url(#tooth-grad)" />
      </g>
      <g stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8">
        <line x1="24" y1="69" x2="23" y2="80" /><line x1="33" y1="72" x2="31" y2="86" /><line x1="42" y1="74" x2="41" y2="89" />
        <line x1="50" y1="75" x2="46" y2="92" /><line x1="58" y1="74" x2="54" y2="92" /><line x1="67" y1="72" x2="61" y2="89" />
        <line x1="76" y1="69" x2="69" y2="86" />
      </g>
      <circle cx="28" cy="35" r="2.5" fill="#FFFFFF" fillOpacity="0.6" />
      <circle cx="38" cy="22" r="1.5" fill="#FFFFFF" fillOpacity="0.4" />
      <circle cx="68" cy="32" r="2" fill="#FFFFFF" fillOpacity="0.5" />
      <circle cx="78" cy="45" r="1.2" fill="#FFFFFF" fillOpacity="0.3" />
      <circle cx="22" cy="48" r="1.8" fill="#FFFFFF" fillOpacity="0.5" />
      <circle cx="48" cy="40" r="2" fill="#FFFFFF" fillOpacity="0.6" />
      <circle cx="58" cy="18" r="1" fill="#FFFFFF" fillOpacity="0.5" />
    </svg>
  );
}

// ─── Scoring Logic ───
function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }

function computeStance(scores: AxisScoreData[], weights: Record<string, number>): string {
  if (scores.length === 0) return "Monitor";
  let totalScore = 0, totalWeight = 0, controlScore = 5, internalScore = 5;
  scores.forEach(s => {
    const w = weights[s.dimensionKey] || 1.0;
    totalScore += s.finalScore * w;
    totalWeight += w;
    if (s.dimensionKey === "control_dependency") controlScore = s.finalScore;
    if (s.dimensionKey === "internal_compatibility") internalScore = s.finalScore;
  });
  const avg = totalWeight > 0 ? totalScore / totalWeight : 0;
  if (controlScore <= 3.0 && avg > 7) return "Explore";
  if (internalScore <= 2.5) return "Monitor";
  if (avg >= 7.5) return "Deepen";
  if (avg >= 6.0) return "Explore";
  if (avg >= 4.5) return "Monitor";
  if (avg >= 3.0) return "Defend";
  return "Avoid";
}

// ─── [1] Axis Explanations for Explainable AI tooltips ───
const AXIS_EXPLAIN: Record<string, { title: string; desc: string; example: string }> = {
  strategic_alignment: { title: "전략 정합성 (Strategic Alignment)", desc: "KT의 중장기 전략 방향과 해당 기업의 사업 방향이 얼마나 일치하는지를 평가합니다.", example: "예: 소버린 AI, B2B 디지털 전환, 클라우드 인프라 확장 등 KT 핵심 전략과의 교집합." },
  capability_complementarity: { title: "역량 보완성 (Capability Complementarity)", desc: "KT가 부족한 역량을 해당 기업이 보완하거나, 반대로 KT가 해당 기업에게 제공할 수 있는 가치를 평가합니다.", example: "예: KT Cloud 인프라 + 파트너의 AI 모델, KT B2G 채널 + 파트너의 플랫폼." },
  monetization_clarity: { title: "수익화 명확성 (Monetization Clarity)", desc: "파트너십을 통한 수익 창출 경로가 얼마나 구체적이고 현실적인지를 평가합니다.", example: "예: 공동 판매, 번들 상품, 라이선스 수익 분배 등 명확한 비즈니스 모델 존재 여부." },
  execution_readiness: { title: "실행 준비도 (Execution Readiness)", desc: "기술적, 조직적, 법적으로 파트너십을 즉시 실행할 수 있는 준비 상태를 평가합니다.", example: "예: API 호환성, 계약 프레임워크, 담당 조직 존재 여부, PoC 경험." },
  control_dependency: { title: "통제/종속 리스크 (Control / Dependency Risk)", desc: "파트너십이 KT의 전략적 자율성을 위협할 수 있는 종속 관계를 만드는지 평가합니다. 높을수록 안전합니다.", example: "예: 단일 공급자 의존, 플랫폼 락인, 데이터 종속, 가격 결정권 상실 위험." },
  market_access: { title: "시장 접근 레버리지 (Market Access Leverage)", desc: "파트너를 통해 새로운 시장, 고객 세그먼트, 채널에 접근할 수 있는 가치를 평가합니다.", example: "예: 파트너의 글로벌 영업망, 정부/공공 채널, 특정 산업 고객 기반." },
  internal_compatibility: { title: "내부 적합성 (Internal Compatibility)", desc: "KT 내부 조직 구조, 문화, 의사결정 체계와 파트너십이 얼마나 잘 맞는지를 평가합니다.", example: "예: 담당 사업부 존재 여부, 내부 이해관계 충돌, 의사결정 속도 차이." },
  timing_urgency: { title: "타이밍/긴급성 (Timing / Strategic Urgency)", desc: "지금 이 파트너십을 추진해야 하는 시장적, 전략적 이유가 얼마나 강한지를 평가합니다.", example: "예: 경쟁사의 선행 움직임, 규제 변화, 기술 전환 시점, 시장 기회의 시한." },
};

// ─── [9] Per-company static data (until AI integration) ───
// [2] techIntel and rumors fields added
const COMPANY_DATA: Record<string, { redTeam: string[]; questions: string[]; strengths: string[]; risks: string[]; engagement: string; people: { name: string; role: string }[]; techIntel: string[]; rumors: string[] }> = {
  "Microsoft": { redTeam: ["Azure가 KT Cloud와 직접 경쟁 — 협력 범위가 실질적으로 제한될 수 있음.", "OpenAI 독점 투자로 AI 모델 접근이 Azure 종속으로 이어질 위험.", "한국 데이터센터 확장이 KT의 소버린 클라우드 전략을 약화시킬 가능성."], questions: ["Azure 한국 리전 확장과 KT Cloud 하이브리드 협력 모델 가능성은?", "Copilot 공공 도입에서 KT B2G 채널 활용 의향은?", "OpenAI 모델의 KT 전용 파인튜닝/온프레미스 배포 가능성은?", "소버린 AI 인프라 구축에서 Microsoft의 역할 구상은?"], strengths: ["B2B/B2G 채널 시너지 최대 — M365+Teams+Copilot과 KT 기업 영업망.", "AI 모델(OpenAI) + 클라우드(Azure) 통합 생태계.", "정부/공공 클라우드 공동 수주 기회."], risks: ["Azure vs KT Cloud 직접 경쟁 구도.", "OpenAI 종속으로 인한 전략적 자율성 감소.", "Copilot이 KT의 자체 AI 서비스와 카니발라이제이션."], engagement: "하이브리드 클라우드 모델(Azure + KT Cloud)을 통한 B2G 공동 수주, Copilot의 KT 기업 고객 대상 번들 판매, 소버린 AI 인프라 공동 구축 파일럿 추진.", people: [{ name: "Satya Nadella", role: "CEO" }, { name: "Kevin Scott", role: "CTO" }, { name: "Judson Althoff", role: "CCO" }], techIntel: ["Azure OpenAI Service에 GPT-5 계열 모델 독점 배포 — Responses API로 reasoning 모델 통합.", "Microsoft Fabric: 데이터 레이크 + AI 통합 플랫폼. Palantir Foundry의 직접 경쟁자로 부상.", "Copilot Studio: 기업이 자체 Copilot을 커스터마이징할 수 있는 로코드 플랫폼. KT 기업 고객 대상 킬러 앱 가능성.", "Azure Confidential Computing: 하드웨어 기반 데이터 암호화. 소버린 AI 인프라의 핵심 기술."], rumors: ["내부적으로 OpenAI 의존도 줄이기 위한 자체 모델(MAI-1 후속) 개발 가속 중이라는 소문.", "Azure 한국 리전 3번째 확장이 2026 하반기 확정이라는 업계 루머 — KT Cloud 직접 위협.", "Copilot 유료 전환율이 예상보다 낮아 내부에서 가격 정책 재검토 중이라는 Blind 정보.", "LinkedIn 데이터를 AI 학습에 활용하려는 내부 프로젝트가 개인정보 이슈로 보류됐다는 정보."] },
  "NVIDIA": { redTeam: ["GPU 수출 규제 확대 시 KT AIDC 공급 차질 위험.", "DGX Cloud 확장이 KT Cloud와 직접 경쟁할 가능성.", "GPU 의존도 과다 — AMD/Intel 대안 부상 시 레버리지 상실."], questions: ["GB300의 한국 할당량 및 납기 타임라인은?", "DGX Cloud의 한국 시장 직접 진출 계획은?", "소버린 AI MOU의 구체적 이행 로드맵은?", "KT AIDC 전용 GPU 클러스터 장기 공급 계약 가능성은?"], strengths: ["AI 인프라의 핵심 공급자 — GPU 없이 AI 사업 불가.", "소버린 AI 인프라 구축에서 최적의 하드웨어 파트너.", "NVIDIA 생태계(CUDA, DGX) + KT 서비스 레이어 시너지."], risks: ["NVIDIA에 대한 과도한 의존 → 가격/공급 협상력 약화.", "DGX Cloud가 KT Cloud 경쟁자로 발전할 가능성.", "수출 규제로 GPU 조달 불확실성."], engagement: "KT AIDC에 차세대 GPU(GB300) 대규모 도입, 소버린 AI 인프라 공동 구축, NVIDIA 스타트업 프로그램과 KT 생태계 연계.", people: [{ name: "Jensen Huang", role: "CEO & Founder" }, { name: "Colette Kress", role: "CFO" }, { name: "Ian Buck", role: "VP Hyperscale" }], techIntel: ["GB300 NVL72: 차세대 AI 슈퍼칩. 단일 랙에서 1.4 exaFLOPS FP4 성능. B200 대비 4배 추론 효율.", "CUDA 생태계 락인이 최대 해자 — AMD ROCm/Intel oneAPI가 추격 중이나 개발자 이탈은 미미.", "NIM(NVIDIA Inference Microservices): 컨테이너 기반 추론 배포 표준화. KT Cloud에 즉시 통합 가능.", "Omniverse: 디지털 트윈 플랫폼. 통신 네트워크 시뮬레이션에 활용 가능성."], rumors: ["GB300 양산이 TSMC CoWoS 패키징 병목으로 2026 Q3까지 지연될 수 있다는 공급망 루머.", "Jensen Huang이 한국 방문 시 삼성전자와 HBM 독점 협상을 진행했다는 업계 정보 — SK하이닉스 긴장.", "내부적으로 ARM 기반 CPU 'Grace' 후속작이 x86 서버 시장 직접 진출을 준비 중이라는 소문.", "DGX Cloud 가격이 경쟁 대비 30% 프리미엄인데 내부에서도 가격 저항이 있다는 Blind 정보."] },
  "Palantir": { redTeam: ["폐쇄적 플랫폼 구조가 KT 자체 데이터 역량 발전을 저해할 가능성.", "미국 정부 의존도 높은 기업 문화가 한국 시장 맞춤화에 한계.", "보안 인가 요건으로 실제 협력 범위가 예상보다 좁아질 가능성."], questions: ["한국 국방 시장에서 KT와의 구체적 채널 협력 모델은?", "Foundry 온프레미스 배포 시 KT Cloud 인프라 활용 의향은?", "AIP(AI Platform)의 한국어 지원 로드맵은?"], strengths: ["B2G(정부/국방) 데이터 분석 최강 — KT B2G 채널과 시너지.", "Foundry 플랫폼 + KT 기업 데이터 분석 역량 결합.", "보안 인가 데이터 처리에서 공동 역량 구축."], risks: ["Palantir 플랫폼 종속 리스크.", "미국 중심 문화로 한국 시장 대응 속도 느림.", "높은 라이선스 비용."], engagement: "국방/공공 데이터 분석 공동 수주, Foundry 온프레미스를 KT Cloud 위에 배포하는 파일럿, AIP와 KT AI 서비스 통합 PoC 추진.", people: [{ name: "Alex Karp", role: "CEO" }, { name: "Shyam Sankar", role: "CTO" }, { name: "Ted Mabrey", role: "Head of Global Commercial" }], techIntel: ["AIP(AI Platform): 기존 Foundry 위에 LLM을 얹은 제품. 기업 데이터를 LLM 컨텍스트에 주입하는 '온톨로지' 구조가 핵심.", "Apollo: 소프트웨어 배포 자동화 도구. 에어갭(Air-gapped) 환경에서도 작동 — 국방/공공에 필수.", "TITAN: 자체 AI 모델 개발 프로젝트. 외부 LLM 의존도를 줄이려는 전략.", "FedStart: 미국 정부 스타트업 프로그램. 정부 데이터 접근 파이프라인의 사실상 표준."], rumors: ["AIP 수익이 전체 매출의 40%를 넘었다는 내부 정보 — 전환이 예상보다 빠름.", "Alex Karp이 한국 방문을 2026 Q2에 계획 중이라는 업계 정보.", "Palantir가 한국 대형 SI(시스템 통합) 업체와 파트너십을 비공개 협상 중이라는 소문 — KT 경쟁 가능성.", "Gotham 플랫폼의 한국 국방부 시범 사업에서 데이터 한국어 처리 이슈가 발생했다는 내부 정보."] },
  "Anthropic": { redTeam: ["Amazon/Google 투자로 인한 전략적 종속 — KT 파트너십 우선순위 밀릴 가능성.", "Claude 모델 경쟁 심화(OpenAI, Google)로 차별화 가치 불확실.", "비상장 기업으로 재무 투명성 제한."], questions: ["Claude 엔터프라이즈 배포에서 KT Cloud를 인프라 파트너로 고려하는가?", "AI Safety 관련 규제 대응에서 KT와의 공동 포지셔닝 가능성은?", "아시아 엔터프라이즈 파트너 프로그램의 한국 파트너 구조는?"], strengths: ["AI Safety 중심 차별화 — 규제 대응에서 유리.", "Claude 모델의 코딩/분석 성능 최상위권.", "KT B2B 채널을 통한 Claude 엔터프라이즈 공동 판매 기회."], risks: ["Amazon/Google 종속으로 전략적 자율성 제한.", "모델 경쟁 심화로 장기 차별화 불확실.", "인프라 자체 미보유 — 클라우드 파트너에 의존."], engagement: "Claude API의 KT Cloud 호스팅 파일럿, KT B2B 채널을 통한 Claude 엔터프라이즈 공동 판매, AI Safety + 데이터 컴플라이언스 공동 솔루션 개발.", people: [{ name: "Dario Amodei", role: "CEO" }, { name: "Daniela Amodei", role: "President" }, { name: "Tom Brown", role: "VP of Product" }], techIntel: ["Constitutional AI: 인간 피드백 없이 AI가 스스로 안전성을 학습하는 기술. 규제 대응의 핵심 차별화.", "Claude Code: CLI 기반 에이전틱 코딩 도구. 개발자 시장 직접 공략.", "MCP(Model Context Protocol): 외부 도구/서비스를 Claude에 연결하는 개방형 프로토콜. 생태계 확장 전략.", "Claude Opus 4.6: 코딩/분석/장문 처리에서 GPT-5와 경쟁하는 최상위 모델."], rumors: ["Amazon이 Anthropic 이사회 의석을 요구하고 있다는 내부 정보 — 독립성 위협.", "Claude 5 개발이 예상보다 빨리 진행 중이며 2026 Q3 출시를 목표로 한다는 소문.", "Anthropic이 자체 추론 칩 설계를 Amazon Trainium 팀과 공동으로 진행 중이라는 루머.", "내부 직원들 사이에서 '안전 우선' 문화와 '시장 속도' 사이의 긴장이 커지고 있다는 Blind 정보."] },
  "xAI": { redTeam: ["Elon Musk의 예측 불가능한 의사결정이 파트너십 안정성에 리스크.", "자체 인프라(Colossus) 구축으로 외부 클라우드 의존도 최소화 전략 — KT 가치 제한적.", "수익 모델 미확정으로 장기 파트너십 ROI 불확실."], questions: ["Grok 모델의 아시아 시장 배포 전략은?", "자체 인프라 외 외부 클라우드 파트너십 필요성을 어떻게 평가하는가?", "X 플랫폼과 Grok의 기업용 분리 제공 계획은?"], strengths: ["소버린 AI 인프라 공동 구축 시너지 잠재력.", "Grok 모델의 빠른 성능 향상 — 파트너십 가치 상승 가능.", "아시아 시장 진출 시 KT가 유력한 현지 파트너."], risks: ["자체 인프라 전략으로 KT Cloud 필요성 낮음.", "수익 모델 불확실 — 투자 회수 불투명.", "Musk 리스크 — 정치적/사회적 변동성."], engagement: "현 시점에서는 정보 수집 중심. Grok의 아시아 시장 전략이 구체화되면 KT Cloud 인프라 파트너십을 제안할 수 있음.", people: [{ name: "Elon Musk", role: "Founder" }, { name: "Igor Babuschkin", role: "CTO" }], techIntel: ["Colossus: 20만 H100 GPU 클러스터. 세계 최대 단일 AI 훈련 인프라 (Memphis, TN).", "Grok 3.5: 코딩/수학 벤치마크 최상위권. X 플랫폼 실시간 데이터 학습이 차별화.", "자체 추론 칩 개발 소문 — NVIDIA 의존도 탈피 전략.", "X API를 통한 실시간 소셜 데이터 접근이 다른 AI 기업 대비 고유한 데이터 해자."], rumors: ["Colossus 2.0으로 100만 GPU 클러스터를 2027년까지 구축한다는 Musk의 비공개 발언 루머.", "xAI가 별도 클라우드 서비스를 준비 중이라는 소문 — AWS/Azure/GCP에 도전?", "내부 엔지니어 이직률이 높다는 Blind 정보 — Musk의 경영 스타일에 대한 피로감.", "Grok API 엔터프라이즈 버전이 2026 Q3 출시 예정이라는 업계 정보."] },
  "Meta": { redTeam: ["Llama 오픈소스 전략은 KT 차별화 가치를 약화 — 누구나 접근 가능.", "Meta의 한국 시장 투자 우선순위가 낮음.", "Reality Labs 손실 지속으로 전략 방향 불확실."], questions: ["Llama 모델의 엔터프라이즈 파인튜닝 파트너십 모델은?", "한국 시장에서 Meta AI의 B2B 전략은?", "한국 AI 연구센터 설립 계획의 구체적 내용은?"], strengths: ["Llama 오픈소스로 AI 모델 접근 용이 — 파인튜닝 자유도.", "WhatsApp/Instagram + KT 통신 번들 가능성.", "Meta AI 추론 인프라 일부 호스팅 기회."], risks: ["오픈소스 모델로 차별적 파트너십 가치 낮음.", "한국 시장 우선순위 낮음.", "광고 수익 편중으로 B2B 전략 약함."], engagement: "Llama 모델 기반 KT 전용 파인튜닝 PoC, WhatsApp Business API + KT 기업 고객 번들 탐색.", people: [{ name: "Mark Zuckerberg", role: "CEO" }, { name: "Andrew Bosworth", role: "CTO" }, { name: "Javier Olivan", role: "COO" }], techIntel: ["Llama 4 Scout/Maverick: Mixture-of-Experts 아키텍처. 오픈 웨이트로 공개. 16개 전문가 모델 라우팅.", "MTIA v2: Meta 자체 AI 추론 칩. NVIDIA 의존도 탈피 시도. 현재 내부 추론 워크로드에 배포 중.", "Reality Labs: Quest 시리즈 + Ray-Ban Meta 스마트 글래스. 연간 $15B+ 투자 지속.", "WhatsApp Channels: 기업/크리에이터용 브로드캐스트 채널. B2B 커뮤니케이션 플랫폼으로 진화 중."], rumors: ["Llama 5가 GPT-5 수준을 목표로 하며 오픈소스 공개를 지속할 것이라는 내부 정보.", "Reality Labs의 내부 프로젝트 리뷰에서 Zuckerberg가 '3년 내 흑자 전환' 데드라인을 제시했다는 소문.", "Meta가 한국 AI 연구소 대신 싱가포르에 아시아 AI 허브를 설립할 수 있다는 루머.", "Instagram Reels의 AI 추천 알고리즘이 내부적으로 'too addictive' 판정을 받아 조정 중이라는 Blind 정보."] },
  "Google": { redTeam: ["Google Cloud의 한국 시장 공격적 확장이 KT Cloud와 직접 충돌.", "Gemini 모델 독점적 통합이 KT의 멀티모델 전략을 제한할 가능성.", "반독점 규제 판결이 파트너십 구조에 영향."], questions: ["소버린 클라우드(Google Distributed Cloud)의 한국 배포 계획은?", "Gemini API의 KT 전용 파인튜닝 파트너십 가능성은?", "한국 정부 클라우드 사업에서 KT와의 협력 vs 경쟁 구도를 어떻게 보는가?"], strengths: ["Gemini 모델 + KT 엔터프라이즈 AI 서비스 통합 시너지.", "Android/YouTube + KT 통신/IPTV 시너지.", "소버린 AI 인프라(Google Distributed Cloud) 공동 구축."], risks: ["Google Cloud vs KT Cloud 직접 경쟁.", "Gemini 종속으로 멀티모델 전략 제한.", "반독점 리스크."], engagement: "Google Distributed Cloud 기반 소버린 AI 인프라 공동 구축, Gemini의 KT 엔터프라이즈 서비스 통합 PoC, 정부 클라우드 공동 입찰 구조 설계.", people: [{ name: "Sundar Pichai", role: "CEO" }, { name: "Thomas Kurian", role: "CEO, Google Cloud" }, { name: "Demis Hassabis", role: "CEO, DeepMind" }], techIntel: ["Gemini 2.5 Pro: 100만 토큰 컨텍스트 윈도우. 코딩/분석 벤치마크 최상위. 'thinking' 모드 내장.", "TPU v6 (Trillium): 자체 AI 칩. H100 대비 성능/전력 효율 우위 주장. Cloud TPU로 외부 제공.", "Google Distributed Cloud (GDC): 온프레미스/에지 배포용 소버린 클라우드. 정부/통신사 타겟.", "Vertex AI: 모델 학습/배포/모니터링 통합 플랫폼. AutoML + 커스텀 모델 + Gemini API 통합."], rumors: ["Google Cloud 한국 팀이 공공 클라우드 시장에서 '가격 덤핑' 전략을 내부 승인받았다는 소문 — KT Cloud 직접 위협.", "DeepMind와 Google Brain 통합 이후 내부 갈등이 여전하다는 Blind 정보 — 연구 방향성 혼선.", "Gemini Ultra 모델의 한국어 성능이 GPT-5 대비 열위라는 내부 평가 루머.", "GDC의 한국 배포가 KT와의 비공식 협의 중이라는 업계 정보 — 아직 공식 발표 전."] },
  "Netflix": { redTeam: ["AI/클라우드 교차점이 제한적 — CDN 최적화 이상의 전략적 깊이 없음.", "Netflix 광고 티어가 KT IPTV 광고와 경쟁.", "콘텐츠 비용 증가로 파트너십 투자 여력 제한."], questions: ["Open Connect CDN의 KT 네트워크 엣지 통합 심화 가능성은?", "한국 오리지널 콘텐츠 투자 확대 시 KT와의 공동 제작 모델은?", "광고 지원 요금제에서 KT IPTV와의 시너지 모델은?"], strengths: ["Netflix + KT IPTV/통신 번들 시너지 강함.", "한국 콘텐츠 투자 적극적 — 공동 제작 기회.", "Open Connect CDN + KT 네트워크 최적화."], risks: ["AI/클라우드 전략적 교차점 제한적.", "광고 티어가 KT IPTV와 경쟁.", "Application 레이어로 인프라 파트너십 깊이 얕음."], engagement: "KT IPTV 독점 번들 확대, 한국 오리지널 콘텐츠 공동 제작/투자, Open Connect CDN의 KT 엣지 노드 통합 심화.", people: [{ name: "Ted Sarandos", role: "Co-CEO" }, { name: "Greg Peters", role: "Co-CEO" }, { name: "Minyoung Kim", role: "VP, Content (Korea)" }], techIntel: ["Open Connect CDN: Netflix 자체 CDN. 전 세계 ISP에 캐시 서버를 무료 배포. KT 네트워크에도 설치됨.", "Cosmos: Netflix 자체 비디오 인코딩 프레임워크. AV1 코덱 최적화. 대역폭 절감 핵심 기술.", "추천 알고리즘: 시청 데이터 + 콘텐츠 메타데이터 + A/B 테스트 기반. 매출의 80%가 추천에서 발생한다는 추정.", "게임 사업: 모바일 게임 40+ 타이틀. 구독자 번들 무료 제공. 아직 초기 단계."], rumors: ["Netflix가 라이브 스포츠 중계에 본격 진출할 것이라는 내부 정보 — WWE에 이어 NFL/NBA 협상 중.", "한국 콘텐츠 투자가 2027년부터 축소될 수 있다는 업계 루머 — ROI 재평가.", "광고 티어의 한국 수익이 예상보다 낮아 광고주 유치에 고전 중이라는 정보.", "Open Connect 팀이 AI 추론 에지 배포를 CDN 인프라에 통합하는 실험을 진행 중이라는 기술 루머."] },
};

// ─── Sub-Components (identical to working version) ───
function StanceBadge({ stance }: { stance: string }) {
  const config = STANCE_CONFIG[stance] || STANCE_CONFIG.Monitor;
  const Icon = config.icon;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 22px", background: config.bg, borderRadius: 14, border: `1.5px solid ${config.color}30` }}>
      <Icon size={20} color={config.color} strokeWidth={2.5} />
      <span style={{ color: config.color, fontWeight: 700, fontSize: 18, letterSpacing: "0.02em" }}>{config.label}</span>
    </div>
  );
}

function AxisBar({ score, weight, signals }: { score: AxisScoreData; weight: number; signals?: Signal[] }) {
  const weighted = clamp(score.finalScore * weight, 0, 10);
  const barWidth = (weighted / 10) * 100;
  const changed = Math.abs(weight - 1.0) > 0.05;
  const explain = AXIS_EXPLAIN[score.dimensionKey];
  const [hover, setHover] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const relatedSignals = (signals || []).filter(s => s.target_axis === score.dimensionKey).slice(0, 3);

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{ padding: "10px 14px", ...glass.cardInner, marginBottom: 8, cursor: "pointer", transition: "border-color 0.2s" }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{score.shortName} <span style={{ fontSize: 9, color: "#94a3b8" }}>ⓘ</span></span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "#94a3b8" }}>{score.finalScore.toFixed(1)} × {weight.toFixed(1)}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: score.isRisk && weighted < 4 ? RED : changed ? TEAL : "#1e293b" }}>
              {weighted.toFixed(1)}
            </span>
          </div>
        </div>
        <div style={{ ...glass.pressed, height: 6, borderRadius: 3, overflow: "hidden", padding: 0, border: "none" }}>
          <div style={{ height: "100%", borderRadius: 3, transition: "width 0.5s ease", width: `${barWidth}%`, background: score.isRisk && weighted < 5 ? `linear-gradient(90deg, ${RED}, ${RED_LIGHT})` : `linear-gradient(90deg, ${TEAL_DARK}, ${TEAL})` }} />
        </div>
      </div>
      {/* [1] Hover tooltip — appears LEFT to avoid Weight Simulation overlap */}
      {hover && explain && !expanded && (
        <div style={{ position: "absolute", zIndex: 9999, top: 0, right: "105%", width: 260, ...glass.card, padding: "12px 14px", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,163,155,0.1)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEAL, marginBottom: 4 }}>{explain.title}</div>
          <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.5, margin: "0 0 6px" }}>{explain.desc}</p>
          <p style={{ fontSize: 10, color: "#94a3b8", margin: 0, fontStyle: "italic" }}>{explain.example}</p>
        </div>
      )}
      {/* [1] Click expanded — evidence */}
      {expanded && (
        <div style={{ ...glass.cardInner, padding: "10px 14px", marginBottom: 8, marginTop: -4, borderTop: `2px solid ${TEAL}20` }}>
          {explain && <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.5, margin: "0 0 8px" }}>{explain.desc}</p>}
          {relatedSignals.length > 0 ? (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: TEAL, marginBottom: 4 }}>관련 신호:</div>
              {relatedSignals.map((s, i) => (
                <div key={i} style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, marginBottom: 4, paddingLeft: 8, borderLeft: `2px solid ${s.impact_score > 0 ? TEAL : RED}30` }}>
                  [{s.event_date}] {s.headline} (impact: {s.impact_score > 0 ? "+" : ""}{s.impact_score})
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 10, color: "#94a3b8", margin: 0 }}>이 축에 직접 관련된 수집 신호가 아직 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  const pos = signal.impact_score > 0;
  return (
    <div style={{ ...glass.cardInner, padding: "12px 16px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>{signal.event_date}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: TEAL_DARK, padding: "1px 8px", background: "rgba(0,163,155,0.08)", borderRadius: 4 }}>{signal.event_type}</span>
            {signal.evidence_quality === "official" && <span style={{ fontSize: 9, color: TEAL, fontWeight: 600 }}>✓ Official</span>}
          </div>
          <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.5, margin: 0 }}>{signal.headline}</p>
        </div>
        <div style={{ padding: "4px 10px", borderRadius: 8, minWidth: 44, textAlign: "center", background: pos ? "rgba(0,163,155,0.08)" : "rgba(229,77,83,0.08)", border: `1px solid ${pos ? TEAL : RED}20` }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: pos ? TEAL : RED }}>{pos ? "+" : ""}{signal.impact_score}</span>
        </div>
      </div>
    </div>
  );
}

function SliderControl({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const pct = ((value - 0.3) / 1.7) * 100;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "#475569" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: TEAL }}>×{value.toFixed(1)}</span>
      </div>
      <div style={{ position: "relative", height: 24, display: "flex", alignItems: "center" }}>
        <div style={{ ...glass.pressed, width: "100%", height: 6, borderRadius: 3, position: "absolute", padding: 0, border: "none" }}>
          <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: `linear-gradient(90deg, ${TEAL_DARK}, ${TEAL})`, transition: "width 0.15s ease" }} />
        </div>
        <input type="range" min={0.3} max={2.0} step={0.1} value={value} onChange={e => onChange(parseFloat(e.target.value))} style={{ position: "absolute", width: "100%", height: 24, opacity: 0, cursor: "pointer", margin: 0 }} />
        <div style={{ position: "absolute", left: `calc(${pct}% - 9px)`, width: 18, height: 18, borderRadius: "50%", background: "white", border: `2.5px solid ${TEAL}`, boxShadow: "0 2px 6px rgba(0,163,155,0.3)", pointerEvents: "none", transition: "left 0.15s ease" }} />
      </div>
    </div>
  );
}

function CustomDot(props: any) {
  const { cx, cy } = props;
  if (!cx || !cy) return null;
  return <circle cx={cx} cy={cy} r={4} fill={TEAL} stroke="white" strokeWidth={2} />;
}

// ─── Collapsible Section helper ───
function Section({ title, icon: Icon, iconColor, badge, defaultOpen, children }: { title: string; icon: any; iconColor: string; badge?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div style={{ ...glass.card, padding: "20px" }}>
      <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%", padding: 0, marginBottom: open ? 12 : 0 }}>
        <Icon size={16} color={iconColor} strokeWidth={2.5} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", flex: 1, textAlign: "left" }}>{title}</span>
        {badge && <span style={{ fontSize: 10, fontWeight: 600, color: iconColor, padding: "2px 8px", background: `${iconColor}14`, borderRadius: 4 }}>{badge}</span>}
        {open ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
      </button>
      {open && children}
    </div>
  );
}

const STANCE_DESC: Record<string, string> = {
  Deepen: "총점과 리스크 지표가 모두 양호합니다. 적극적인 협력 심화를 추천합니다.",
  Explore: "잠재력은 높으나 일부 리스크 지표가 Floor에 근접합니다. 파일럿 수준의 탐색적 협력을 추천합니다.",
  Monitor: "현재 데이터로는 적극적 판단이 어렵습니다. 추가 정보 수집 후 재평가가 필요합니다.",
  Defend: "경쟁 신호가 감지되었습니다. 방어적 전략과 대안 파트너 탐색을 병행하세요.",
  Avoid: "현 시점에서 적극적 파트너십 추진은 부적절합니다.",
};

// Deep per-company stance rationale
const COMPANY_STANCE: Record<string, Record<string, string>> = {
  "Microsoft": {
    Deepen: "Azure+OpenAI 생태계와 KT B2B/B2G 채널의 시너지가 압도적입니다. 다만 Azure vs KT Cloud 경쟁 관계를 하이브리드 모델로 구조화하는 것이 Deepen의 전제 조건입니다. Copilot 번들 판매와 소버린 AI 공동 구축을 동시 추진할 수 있는 유일한 파트너입니다.",
    Explore: "B2B/B2G 시너지 잠재력은 최상위이나, Azure와 KT Cloud 간 직접 경쟁(통제/종속 리스크 3.4점)이 Deepen 진입을 차단합니다. 하이브리드 클라우드 모델의 PoC를 통해 경쟁과 협력의 경계를 먼저 검증해야 합니다. Copilot 번들 파일럿으로 B2B 채널 시너지를 소규모로 확인하세요.",
    Monitor: "클라우드 경쟁 구도가 심화되고 있어 적극적 접근이 리스크입니다. Microsoft의 한국 데이터센터 확장 전략이 확정된 후 재평가가 필요합니다.",
  },
  "NVIDIA": {
    Deepen: "AI 인프라의 핵심 공급자로서 대체 불가능한 위치입니다. KT AIDC에 차세대 GPU를 선제 확보하고, 소버린 AI 인프라 공동 구축을 공식화할 시점입니다.",
    Explore: "NVIDIA는 KT의 AI 인프라 전략에서 가장 중요한 파트너이지만, GPU 단일 공급자 의존도(통제/종속 리스크 3.0점)가 Floor 조건에 걸립니다. GB300 대규모 도입 전에 AMD MI350X 등 대안 칩 평가를 병행하여 협상력을 확보하면서, 소버린 AI MOU 이행 파일럿을 우선 추진하세요.",
    Monitor: "GPU 수출 규제 불확실성과 DGX Cloud 직접 경쟁 가능성을 추가 관찰할 필요가 있습니다.",
  },
  "Palantir": {
    Deepen: "B2G 데이터 분석 시장에서 KT 채널과의 시너지가 최상급입니다. 한국 국방부 사업을 기반으로 공동 수주 체계를 공식화할 단계입니다.",
    Explore: "한국 국방부 데이터 분석 수주와 서울 오피스 개설로 한국 시장 진출이 본격화되고 있습니다. KT의 B2G 채널을 활용한 공동 수주 모델을 파일럿 수준에서 먼저 검증하세요. Foundry를 KT Cloud 위에 배포하는 기술 PoC가 첫 단계입니다.",
    Monitor: "Palantir의 폐쇄적 플랫폼 구조와 높은 라이선스 비용이 검증되어야 합니다.",
  },
  "Anthropic": {
    Deepen: "Claude 모델의 경쟁력과 AI Safety 차별화가 뛰어납니다. KT Cloud 호스팅 + B2B 공동 판매 체계를 본격 구축할 시점입니다.",
    Explore: "Claude 모델의 코딩/분석 성능이 최상위권이고, AI Safety 포지셔닝은 규제 대응에서 유리합니다. 그러나 Amazon/Google 투자에 의한 전략적 종속이 KT 파트너십 우선순위를 낮출 수 있습니다. 아시아 엔터프라이즈 파트너 프로그램에 KT를 초기 파트너로 참여시키는 것이 우선입니다.",
    Monitor: "Amazon/Google 종속 구도가 KT 협력에 미치는 실질적 영향을 관찰할 필요가 있습니다.",
  },
  "xAI": {
    Explore: "Grok 모델의 빠른 성장과 아시아 시장 진출 탐색이 기회이지만, 자체 인프라 전략과 수익 모델 미확정이 큰 리스크입니다.",
    Monitor: "xAI는 소버린 AI 시너지 잠재력이 있으나, Colossus 자체 인프라 전략으로 외부 클라우드 의존도를 최소화하려 합니다(통제/종속 리스크 2.5점). 수익 모델이 미확정이고 Elon Musk의 의사결정 변동성이 큽니다. Grok의 아시아 시장 전략이 구체화될 때까지 정보 수집에 집중하되, 한국 진출 시 KT가 첫 번째 제안 파트너가 되도록 관계를 유지하세요.",
    Avoid: "수익 모델과 전략 방향이 너무 불확실하여 리소스 투입은 부적절합니다.",
  },
  "Meta": {
    Explore: "Llama 오픈소스와 소비자 플랫폼 시너지를 소규모로 검증할 가치는 있습니다.",
    Monitor: "Llama 오픈소스는 누구나 접근 가능하여 KT만의 차별적 파트너십 가치가 낮습니다. 한국 시장 투자 우선순위도 높지 않습니다. WhatsApp Business 번들 가능성과 한국 AI 연구센터 설립 여부를 지켜보면서, Llama 파인튜닝 PoC 정도의 저비용 탐색만 진행하세요.",
    Avoid: "전략적 교차점이 얕고, Meta의 한국 시장 우선순위가 낮아 적극 추진은 비효율적입니다.",
  },
  "Google": {
    Deepen: "Gemini + GDC 기반 소버린 AI 파트너십이 KT 전략과 완벽히 정렬됩니다.",
    Explore: "Gemini 2.5 Pro의 성능과 Google Distributed Cloud(GDC)의 소버린 클라우드 전략이 KT와 교차합니다. 그러나 Google Cloud의 한국 시장 공격적 확장(정부 클라우드 입찰 참여)이 직접 경쟁 리스크입니다. GDC 한국 배포를 KT 인프라 위에서 진행하는 파일럿으로 경쟁/협력 구도를 정리하세요.",
    Monitor: "Google Cloud와의 경쟁 심화 추이를 관찰하며 입장을 정리할 필요가 있습니다.",
  },
  "Netflix": {
    Explore: "IPTV 번들과 한국 콘텐츠 공동 투자에서 구체적 시너지가 있습니다.",
    Monitor: "Netflix와의 교차점은 소비자 채널(IPTV 번들)과 CDN 최적화에 집중되어 있으며, AI/클라우드 전략적 깊이는 제한적입니다. KT IPTV 독점 번들 확대와 한국 콘텐츠 공동 제작 모델을 분기별로 리뷰하면서, Open Connect CDN 엣지 통합 심화를 저비용으로 진행하세요.",
    Avoid: "전략적 파트너십보다는 채널 딜 수준의 관계로 충분합니다.",
  },
};

// [3] Preset display order
const PRESET_ORDER = ["Default", "Growth Mode", "Risk-Minimizing", "Control-First"];

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════

export default function SPITFIREPage() {
  const { loading, error, organizations, selectedOrgId, dashboard, presets, selectOrganization, refresh } = useSpitfireData();

  const [activePreset, setActivePreset] = useState("Default");
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [showSignals, setShowSignals] = useState(true);

  useEffect(() => {
    if (presets.length > 0) {
      const defaultPreset = presets.find(p => p.name === "Default");
      if (defaultPreset) setWeights(defaultPreset.weights_json);
    }
  }, [presets]);

  useEffect(() => {
    setActivePreset("Default");
    const defaultPreset = presets.find(p => p.name === "Default");
    if (defaultPreset) setWeights(defaultPreset.weights_json);
  }, [selectedOrgId]);

  const scores = dashboard?.scores || [];
  const signals = dashboard?.signals || [];
  const confidence = dashboard?.confidence || 0;
  const org = dashboard?.organization;
  const orgName = org?.name || "";
  const cd = COMPANY_DATA[orgName] || COMPANY_DATA["Microsoft"];

  const stance = useMemo(() => computeStance(scores, weights), [scores, weights]);
  const stanceConfig = STANCE_CONFIG[stance] || STANCE_CONFIG.Monitor;

  const radarData = useMemo(() => scores.map(s => ({
    axis: s.shortName,
    score: clamp(s.finalScore * (weights[s.dimensionKey] || 1.0), 0, 10),
    fullMark: 10,
  })), [scores, weights]);

  const weightedAvg = useMemo(() => {
    if (scores.length === 0) return 0;
    let ts = 0, tw = 0;
    scores.forEach(s => { const w = weights[s.dimensionKey] || 1; ts += s.finalScore * w; tw += w; });
    return tw > 0 ? ts / tw : 0;
  }, [scores, weights]);

  // [3] Sort presets
  const sortedPresets = useMemo(() => {
    return PRESET_ORDER.map(name => presets.find(p => p.name === name)).filter(Boolean) as typeof presets;
  }, [presets]);

  const handlePreset = useCallback((presetName: string) => {
    const p = presets.find(pr => pr.name === presetName);
    if (p) { setActivePreset(presetName); setWeights(p.weights_json); }
  }, [presets]);

  const updateWeight = useCallback((key: string, val: number) => {
    setWeights(prev => ({ ...prev, [key]: val }));
    setActivePreset("Custom");
  }, []);

  if (loading && !dashboard) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f0f2f5, #e8ecf1, #f5f7fa)", fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>
        <div style={{ ...glass.card, padding: "40px 60px", textAlign: "center" }}>
          <Loader2 size={32} color={TEAL} style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ color: "#64748b", marginTop: 16, fontSize: 14 }}>Connecting to Supabase...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f0f2f5, #e8ecf1, #f5f7fa)", fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}>
        <div style={{ ...glass.card, padding: "40px 60px", textAlign: "center", maxWidth: 500 }}>
          <Database size={32} color={RED} />
          <p style={{ color: "#1e293b", marginTop: 16, fontSize: 15, fontWeight: 600 }}>Supabase 연결 실패</p>
          <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>{error}</p>
          <button onClick={refresh} style={{ ...glass.button, marginTop: 16, padding: "8px 20px", fontSize: 13, fontWeight: 600, color: TEAL, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={14} /> 재시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", padding: "20px",
      background: "linear-gradient(135deg, #f0f2f5 0%, #e8ecf1 30%, #f5f7fa 60%, #eef1f5 100%)",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif",
    }}>
      {/* ─── Header [1][2] ─── */}
      <div style={{ maxWidth: 1280, margin: "0 auto", marginBottom: 20 }}>
        <div style={{ ...glass.card, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <SpitfireLogo size={42} />
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 }}>SPITFIRE</h1>
                <span style={{ fontSize: 9, fontWeight: 600, color: TEAL, background: "rgba(0,163,155,0.08)", padding: "2px 6px", borderRadius: 4 }}>PILOT v1.0</span>
                {dashboard && <span style={{ fontSize: 9, fontWeight: 600, color: TEAL, background: "rgba(0,163,155,0.08)", padding: "2px 6px", borderRadius: 4 }}>DB LIVE</span>}
              </div>
              <p style={{ fontSize: 10, color: "#94a3b8", margin: 0, fontWeight: 500 }}>Strategic Partnership Intelligence & Tactical Framework for Innovation, Relationship, and Execution</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={refresh} style={{ ...glass.button, padding: "6px 12px", display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748b", fontWeight: 500, border: "none" }}>
              <RefreshCw size={12} color="#94a3b8" /> Refresh
            </button>
            <div style={{ ...glass.pressed, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}>
              <Users size={13} color="#94a3b8" />
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{organizations.length} Companies</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Company Selector ─── */}
      <div style={{ maxWidth: 1280, margin: "0 auto", marginBottom: 20 }}>
        <div style={{ ...glass.card, padding: "20px 28px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {organizations.map(o => (
              <button key={o.id} onClick={() => selectOrganization(o.id)} style={{
                padding: "7px 16px", border: "none", borderRadius: 10, fontSize: 12,
                fontWeight: selectedOrgId === o.id ? 700 : 500, cursor: "pointer",
                color: selectedOrgId === o.id ? "white" : "#64748b",
                background: selectedOrgId === o.id ? `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})` : glass.button.background,
                boxShadow: selectedOrgId === o.id ? `0 3px 12px ${TEAL}40` : glass.button.boxShadow,
                transition: "all 0.25s ease",
              }}>
                {o.name}
                {o.ticker && <span style={{ opacity: 0.7, marginLeft: 4, fontSize: 10 }}>({o.ticker})</span>}
              </button>
            ))}
          </div>
          {org && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
                  <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0 }}>{org.name}</h2>
                  <StanceBadge stance={stance} />
                </div>
                <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{org.industry} · {org.business_layer} Layer{org.ticker ? ` · ${org.ticker}` : " · Private"}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4, fontWeight: 500 }}>Confidence</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ ...glass.pressed, width: 100, height: 8, borderRadius: 4, overflow: "hidden", padding: 0, border: "none" }}>
                    <div style={{ height: "100%", borderRadius: 4, width: `${confidence * 100}%`, background: confidence >= 0.6 ? `linear-gradient(90deg, ${TEAL_DARK}, ${TEAL})` : `linear-gradient(90deg, #D97706, #F59E0B)` }} />
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: confidence >= 0.6 ? TEAL : "#F59E0B" }}>{(confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Main Grid ─── */}
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Radar + Scores */}
          <div style={{ ...glass.card, padding: "24px" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "0 0 4px 0" }}>8-Axis Partnership Evaluation</h3>
            <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 16px 0" }}>슬라이더 가중치 반영 · 외곽: 10점</p>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <div style={{ flex: 1, height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                    <PolarGrid stroke="#cbd5e1" strokeWidth={0.5} />
                    <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "#64748b", fontWeight: 500 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                    <Radar name="Score" dataKey="score" stroke={TEAL} fill={TEAL} fillOpacity={0.15} strokeWidth={2} dot={<CustomDot />} />
                    <Tooltip contentStyle={{ ...glass.card, padding: "8px 14px", fontSize: 12, border: "none" }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ width: 220 }}>
                {scores.map(s => <AxisBar key={s.dimensionKey} score={s} weight={weights[s.dimensionKey] || 1} signals={signals} />)}
              </div>
            </div>
          </div>

          {/* [7] KT Partnership Strengths / Risks */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <Section title="KT 파트너십 강점" icon={TrendingUp} iconColor={TEAL}>
              {cd.strengths.map((s, i) => (
                <div key={i} style={{ ...glass.cardInner, padding: "10px 14px", marginBottom: 8, borderLeft: `3px solid ${TEAL}40` }}>
                  <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, margin: 0 }}>{s}</p>
                </div>
              ))}
            </Section>
            <Section title="유의해야 할 점" icon={AlertTriangle} iconColor={RED}>
              {cd.risks.map((r, i) => (
                <div key={i} style={{ ...glass.cardInner, padding: "10px 14px", marginBottom: 8, borderLeft: `3px solid ${RED}40` }}>
                  <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, margin: 0 }}>{r}</p>
                </div>
              ))}
            </Section>
          </div>

          {/* [4] Recent Signals */}
          <Section title="Recent Signals" icon={Activity} iconColor={TEAL} badge={String(signals.length)}>
            {signals.length > 0 ? signals.map(s => <SignalCard key={s.id} signal={s} />) : <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>수집된 최근 신호가 없습니다. TINA Signal Engine 수집 후 표시됩니다.</p>}
          </Section>

          {/* Red Team Warnings */}
          <Section title="Red Team Warnings" icon={AlertTriangle} iconColor={RED} defaultOpen={false}>
            {cd.redTeam.map((w, i) => (
              <div key={i} style={{ ...glass.cardInner, padding: "10px 14px", marginBottom: 8, borderLeft: `3px solid ${RED}40` }}>
                <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, margin: 0 }}>{w}</p>
              </div>
            ))}
          </Section>

          {/* [8] Meeting Talking Points */}
          <Section title="미팅 핵심 토킹 포인트" icon={MessageSquare} iconColor={TEAL} badge={cd.questions.length + "개"} defaultOpen={false}>
            {cd.questions.map((q, i) => (
              <div key={i} style={{ ...glass.cardInner, padding: "10px 14px", marginBottom: 8, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: TEAL, minWidth: 22 }}>Q{i + 1}</span>
                <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, margin: 0 }}>{q}</p>
              </div>
            ))}
          </Section>

          {/* [9] Key Personnel */}
          <Section title="주요 인사" icon={UserCircle} iconColor={TEAL_DARK} defaultOpen={false}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {cd.people.map((p, i) => (
                <a key={i} href={`https://www.google.com/search?q=${encodeURIComponent(p.name + " " + orgName + " LinkedIn")}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                  <div style={{ ...glass.cardInner, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", transition: "box-shadow 0.2s" }}>
                    <UserCircle size={16} color={TEAL} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{p.name} <span style={{ fontSize: 9, color: TEAL }}>↗</span></div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{p.role}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </Section>
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* [3] Weight Simulation — ordered presets */}
          <div style={{ ...glass.card, padding: "20px" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 12px 0" }}>Weight Simulation</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {sortedPresets.map(p => (
                <button key={p.name} onClick={() => handlePreset(p.name)} style={{
                  padding: "5px 12px", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  color: activePreset === p.name ? "white" : "#64748b",
                  background: activePreset === p.name ? `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})` : "rgba(255,255,255,0.6)",
                  boxShadow: activePreset === p.name ? `0 3px 10px ${TEAL}40` : glass.button.boxShadow,
                  transition: "all 0.25s ease",
                }}>{p.name}</button>
              ))}
              {activePreset === "Custom" && <span style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><RotateCcw size={11} /> Custom</span>}
            </div>
            {scores.map(s => <SliderControl key={s.dimensionKey} label={s.shortName} value={weights[s.dimensionKey] || 1} onChange={v => updateWeight(s.dimensionKey, v)} />)}
          </div>

          {/* [5] Current Stance with weighted avg */}
          <div style={{ ...glass.card, padding: "20px", background: `linear-gradient(135deg, rgba(255,255,255,0.6), ${stanceConfig.bg})` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>Current Stance</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: stanceConfig.color }}>{weightedAvg > 0 ? weightedAvg.toFixed(1) : "—"}</span>
            </div>
            <StanceBadge stance={stance} />
            <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginTop: 12, marginBottom: 0 }}>{(COMPANY_STANCE[orgName] && COMPANY_STANCE[orgName][stance]) || STANCE_DESC[stance]}</p>
          </div>

          {/* [6] Recommended Engagement — detailed */}
          <div style={{ ...glass.card, padding: "20px" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginBottom: 8 }}>Recommended Engagement</div>
            <div style={{ ...glass.cardInner, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <ArrowRight size={14} color={TEAL} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                  {stance === "Deepen" && "Co-build / Joint GTM"}
                  {stance === "Explore" && "Pilot / Limited Co-sell"}
                  {stance === "Monitor" && "Quarterly Review"}
                  {stance === "Defend" && "Counter-strategy"}
                  {stance === "Avoid" && "No Active Pursuit"}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, margin: 0 }}>{cd.engagement}</p>
            </div>
          </div>

          {/* Why Not Now */}
          <div style={{ ...glass.card, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: RED, fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={12} /> Why Not Now
            </div>
            <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, margin: 0 }}>
              {cd.redTeam[0]}
            </p>
          </div>

          {/* [2] Tech Intelligence */}
          <Section title="Engineering / Tech Intel" icon={Activity} iconColor={TEAL_DARK} defaultOpen={false}>
            {cd.techIntel.map((t, i) => (
              <div key={i} style={{ ...glass.cardInner, padding: "10px 14px", marginBottom: 8, borderLeft: `3px solid ${TEAL_DARK}30` }}>
                <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, margin: 0 }}>{t}</p>
              </div>
            ))}
          </Section>

          {/* [2] Rumors & Blind */}
          <Section title="Rumors & Insider Talk" icon={MessageSquare} iconColor="#F59E0B" defaultOpen={false}>
            <div style={{ ...glass.cardInner, padding: "8px 12px", marginBottom: 10, background: "rgba(245,158,11,0.06)", borderRadius: 8 }}>
              <p style={{ fontSize: 10, color: "#F59E0B", margin: 0, fontWeight: 600 }}>⚠ 아래 정보는 미확인 소스 기반이며, 의사결정의 보조 참고자료로만 활용하세요.</p>
            </div>
            {cd.rumors.map((r, i) => (
              <div key={i} style={{ ...glass.cardInner, padding: "10px 14px", marginBottom: 8, borderLeft: "3px solid rgba(245,158,11,0.3)" }}>
                <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, margin: 0 }}>{r}</p>
              </div>
            ))}
          </Section>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "24px auto 0", textAlign: "center" }}>
        <p style={{ fontSize: 10, color: "#94a3b8" }}>SPITFIRE · KT Internal Use Only · Powered by TINA Signal Engine + Azure OpenAI</p>
      </div>
    </div>
  );
}
