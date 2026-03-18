/**
 * SPITFIRE — Scoring & Stance Engine
 * Strategic Partnership Intelligence & Tactical Framework
 * for Insight-driven Relationship Engineering
 * 
 * 핵심 원칙:
 *   - AI는 추출/요약만 담당
 *   - 점수 계산과 Stance 결정은 이 파일의 규칙 엔진이 수행
 *   - gpt-5-nano에게 이 로직을 위임하면 환각이 발생한다
 */

// ── Types ──

export type AxisKey =
  | "strategic_alignment"
  | "capability_complementarity"
  | "monetization_clarity"
  | "execution_readiness"
  | "control_dependency"
  | "market_access"
  | "internal_compatibility"
  | "timing_urgency";

export type Stance = "Deepen" | "Explore" | "Monitor" | "Defend" | "Avoid";

export type EngagementModel =
  | "Co-build / Joint GTM"
  | "Pilot / Limited Co-sell"
  | "Information Gathering / Quarterly Review"
  | "Counter-strategy / Alternative Partners"
  | "No Active Pursuit";

export interface AxisScore {
  key: AxisKey;
  structuralScore: number;     // 1~10, from organization_scores
  eventDelta: number;          // -5~+5, from recent signals
  manualOverrideDelta: number; // -5~+5, from manual_overrides
  finalScore: number;          // clamped 1~10
  confidence: number;          // 0~1
  isRiskDimension: boolean;
  floorThreshold: number | null;
}

export interface SliderWeights {
  [key: string]: number;       // AxisKey → weight (0.3 ~ 2.0)
}

export interface SimulationResult {
  stance: Stance;
  engagementModel: EngagementModel;
  totalWeightedScore: number;
  averageWeightedScore: number;
  overallConfidence: number;
  axisResults: AxisResult[];
  guardrailViolations: GuardrailViolation[];
  whyNotNow: string | null;
}

export interface AxisResult {
  key: AxisKey;
  baselineScore: number;
  finalScore: number;
  weight: number;
  weightedScore: number;
  confidence: number;
}

export interface GuardrailViolation {
  rule: string;
  axis: AxisKey;
  threshold: number;
  actualValue: number;
  blockedStance: Stance;
  message: string;
}

// ── Axis Definitions ──

export const AXIS_DEFINITIONS: Record<AxisKey, {
  name: string;
  shortName: string;
  description: string;
  isRisk: boolean;
  floorThreshold: number | null;
  displayOrder: number;
}> = {
  strategic_alignment: {
    name: "Strategic Alignment",
    shortName: "전략 정합",
    description: "KT 전략 방향과의 일치도",
    isRisk: false, floorThreshold: null, displayOrder: 1,
  },
  capability_complementarity: {
    name: "Capability Complementarity",
    shortName: "역량 보완",
    description: "상호 역량 결핍 보완 정도",
    isRisk: false, floorThreshold: null, displayOrder: 2,
  },
  monetization_clarity: {
    name: "Monetization Clarity",
    shortName: "수익화 명확",
    description: "단기/중기 수익화 가시성",
    isRisk: false, floorThreshold: null, displayOrder: 3,
  },
  execution_readiness: {
    name: "Execution Readiness",
    shortName: "실행 준비",
    description: "기술/조직/계약 실행 준비 수준",
    isRisk: false, floorThreshold: null, displayOrder: 4,
  },
  control_dependency: {
    name: "Control / Dependency Risk",
    shortName: "통제 리스크",
    description: "종속/통제 리스크 (높을수록 안전)",
    isRisk: true, floorThreshold: 3.0, displayOrder: 5,
  },
  market_access: {
    name: "Market Access Leverage",
    shortName: "시장 접근",
    description: "B2B/B2G 채널 활용 가치",
    isRisk: false, floorThreshold: null, displayOrder: 6,
  },
  internal_compatibility: {
    name: "Internal Compatibility",
    shortName: "내부 적합",
    description: "KT 내부 조직 적합성",
    isRisk: true, floorThreshold: 2.5, displayOrder: 7,
  },
  timing_urgency: {
    name: "Timing / Strategic Urgency",
    shortName: "타이밍",
    description: "Why now 판단 근거",
    isRisk: false, floorThreshold: null, displayOrder: 8,
  },
};

// ── Core Functions ──

/** 값을 [min, max] 범위로 제한 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 축별 최종 점수 계산 */
export function computeFinalAxisScore(
  structural: number,
  eventDelta: number,
  manualDelta: number = 0,
): number {
  return clamp(structural + eventDelta + manualDelta, 1, 10);
}

/**
 * Guardrail Rules 검사
 * 
 * R1: control_dependency ≤ 3.0 → Deepen 금지
 * R2: internal_compatibility ≤ 2.5 → Explore 이상 제한
 * R3: overall confidence < 0.4 → 데이터 부족 경고
 */
export function checkGuardrails(
  axisScores: Map<AxisKey, number>,
  confidence: number,
): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];

  const controlScore = axisScores.get("control_dependency") ?? 5;
  if (controlScore <= 3.0) {
    violations.push({
      rule: "FLOOR_CONTROL_DEPENDENCY",
      axis: "control_dependency",
      threshold: 3.0,
      actualValue: controlScore,
      blockedStance: "Deepen",
      message: `통제/종속 리스크 점수(${controlScore.toFixed(1)})가 Floor(3.0) 이하입니다. Deepen 불가.`,
    });
  }

  const internalScore = axisScores.get("internal_compatibility") ?? 5;
  if (internalScore <= 2.5) {
    violations.push({
      rule: "FLOOR_INTERNAL_COMPATIBILITY",
      axis: "internal_compatibility",
      threshold: 2.5,
      actualValue: internalScore,
      blockedStance: "Explore",
      message: `내부 적합성 점수(${internalScore.toFixed(1)})가 Floor(2.5) 이하입니다. Explore 이상 제한.`,
    });
  }

  if (confidence < 0.4) {
    violations.push({
      rule: "LOW_CONFIDENCE",
      axis: "strategic_alignment", // placeholder
      threshold: 0.4,
      actualValue: confidence,
      blockedStance: "Deepen",
      message: `전체 Confidence(${(confidence * 100).toFixed(0)}%)가 40% 미만입니다. 데이터 보강 필요.`,
    });
  }

  return violations;
}

/**
 * Stance 결정 로직
 * 
 * 단순 점수 합계가 아니라:
 * 1. 가중 평균 계산
 * 2. Guardrail Rules 적용 (Floor 조건)
 * 3. Confidence 임계 적용
 */
export function determineStance(
  avgWeightedScore: number,
  guardrailViolations: GuardrailViolation[],
  confidence: number,
): Stance {
  // Floor violations이 있으면 상위 Stance 차단
  const blockedStances = new Set(guardrailViolations.map(v => v.blockedStance));
  const hasInternalFloor = guardrailViolations.some(
    v => v.rule === "FLOOR_INTERNAL_COMPATIBILITY"
  );

  // 기본 점수 기반 판단
  let candidateStance: Stance;
  if (avgWeightedScore >= 7.5) candidateStance = "Deepen";
  else if (avgWeightedScore >= 6.0) candidateStance = "Explore";
  else if (avgWeightedScore >= 4.5) candidateStance = "Monitor";
  else if (avgWeightedScore >= 3.0) candidateStance = "Defend";
  else candidateStance = "Avoid";

  // Guardrail downgrade
  if (blockedStances.has("Deepen") && candidateStance === "Deepen") {
    candidateStance = "Explore";
  }
  if (hasInternalFloor && (candidateStance === "Deepen" || candidateStance === "Explore")) {
    candidateStance = "Monitor";
  }

  // Low confidence downgrade
  if (confidence < 0.4 && (candidateStance === "Deepen" || candidateStance === "Explore")) {
    candidateStance = "Monitor";
  }

  return candidateStance;
}

/** Stance → Engagement Model 매핑 */
export function getEngagementModel(stance: Stance): EngagementModel {
  const map: Record<Stance, EngagementModel> = {
    Deepen:  "Co-build / Joint GTM",
    Explore: "Pilot / Limited Co-sell",
    Monitor: "Information Gathering / Quarterly Review",
    Defend:  "Counter-strategy / Alternative Partners",
    Avoid:   "No Active Pursuit",
  };
  return map[stance];
}

/**
 * Confidence 4요소 계산
 * 
 * 1. Data Depth: organization_profile 필드 채움 비율
 * 2. Signal Freshness: 최근 30일 이벤트 수 / 기대 최소치
 * 3. Evidence Quality: 공식 소스 비율
 * 4. Coverage Completeness: 점수 부여된 축 수 / 8
 */
export function computeConfidence(params: {
  profileFieldsFilled: number;  // 0~1
  recentSignalCount: number;    // 최근 30일 이벤트 수
  expectedMinSignals: number;   // 기대 최소 이벤트 수 (예: 5)
  officialSourceRatio: number;  // 0~1
  scoredAxisCount: number;      // 0~8
}): {
  overall: number;
  dataDepth: number;
  signalFreshness: number;
  evidenceQuality: number;
  coverageCompleteness: number;
} {
  const dataDepth = clamp(params.profileFieldsFilled, 0, 1);
  const signalFreshness = clamp(
    params.recentSignalCount / Math.max(params.expectedMinSignals, 1),
    0, 1,
  );
  const evidenceQuality = clamp(params.officialSourceRatio, 0, 1);
  const coverageCompleteness = clamp(params.scoredAxisCount / 8, 0, 1);

  // 가중 평균 (Coverage가 가장 중요)
  let overall =
    dataDepth * 0.2 +
    signalFreshness * 0.25 +
    evidenceQuality * 0.2 +
    coverageCompleteness * 0.35;

  // Coverage가 50% 미만이면 강제 패널티
  if (coverageCompleteness < 0.5) {
    overall *= 0.75;
  }

  return {
    overall: clamp(overall, 0, 1),
    dataDepth,
    signalFreshness,
    evidenceQuality,
    coverageCompleteness,
  };
}

/**
 * 전체 시뮬레이션 실행
 * 
 * Input: 축별 점수 + 슬라이더 가중치
 * Output: Stance + Engagement + 상세 결과
 */
export function runSimulation(
  axisScores: AxisScore[],
  weights: SliderWeights,
): SimulationResult {
  // 1. 축별 가중 점수 계산
  const axisResults: AxisResult[] = axisScores.map((a) => {
    const w = weights[a.key] ?? 1.0;
    return {
      key: a.key,
      baselineScore: a.structuralScore,
      finalScore: a.finalScore,
      weight: w,
      weightedScore: a.finalScore * w,
      confidence: a.confidence,
    };
  });

  // 2. 가중 평균
  const totalWeight = axisResults.reduce((sum, r) => sum + r.weight, 0);
  const totalWeightedScore = axisResults.reduce((sum, r) => sum + r.weightedScore, 0);
  const averageWeightedScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

  // 3. 전체 Confidence
  const overallConfidence = axisScores.reduce((sum, a) => sum + a.confidence, 0) / axisScores.length;

  // 4. Guardrail 검사
  const scoreMap = new Map<AxisKey, number>();
  axisScores.forEach((a) => scoreMap.set(a.key, a.finalScore));
  const guardrailViolations = checkGuardrails(scoreMap, overallConfidence);

  // 5. Stance 결정
  const stance = determineStance(averageWeightedScore, guardrailViolations, overallConfidence);
  const engagementModel = getEngagementModel(stance);

  // 6. Why Not Now (간단 규칙)
  let whyNotNow: string | null = null;
  if (guardrailViolations.length > 0) {
    whyNotNow = guardrailViolations.map((v) => v.message).join(" ");
  } else if (overallConfidence < 0.6) {
    whyNotNow = "Confidence가 60% 미만으로, 현 시점에서 적극적 판단에 필요한 데이터가 부족합니다.";
  }

  return {
    stance,
    engagementModel,
    totalWeightedScore,
    averageWeightedScore,
    overallConfidence,
    axisResults,
    guardrailViolations,
    whyNotNow,
  };
}

// ══════════════════════════════════════════════════════════════
// Signal Freshness Decay System
//
// 데이터 보존 정책:
//   - 삭제 없음. 모든 signal은 영구 보존한다.
//   - freshness_bucket에 따라 점수 영향력만 감쇠한다.
//   - TINA Signal Engine이 매일 1회 수집 (KST 07:00).
//   - Supabase Free Tier 500MB 기준, 기업 10개 × 1년 = ~20MB.
//     용량은 Phase 1~2에서 문제되지 않는다.
// ══════════════════════════════════════════════════════════════

export type FreshnessBucket = "7d" | "30d" | "90d" | "stale";

/** Freshness bucket별 event_delta 반영 가중치 */
const FRESHNESS_DECAY_WEIGHTS: Record<FreshnessBucket, number> = {
  "7d":    1.0,   // 최근 7일: 100% 반영
  "30d":   0.6,   // 최근 30일: 60% 반영
  "90d":   0.25,  // 최근 90일: 25% 반영
  "stale": 0.0,   // 90일 초과: 점수에 영향 없음 (DB에는 보존)
};

/** Signal의 freshness 가중치 반환 */
export function getFreshnessWeight(bucket: FreshnessBucket): number {
  return FRESHNESS_DECAY_WEIGHTS[bucket] ?? 0;
}

/**
 * 특정 축에 대한 Event Delta 계산
 *
 * 같은 축에 영향을 주는 모든 signal의 impact_score를
 * freshness 가중치로 감쇠하여 합산한다.
 *
 * 예: impact +3 (7d) + impact -1 (30d) = 3×1.0 + (-1)×0.6 = 2.4
 * 최종 delta는 [-5, +5] 범위로 clamp.
 */
export function computeEventDelta(
  signals: Array<{
    impact_score: number;        // -3 ~ +3
    freshness_bucket: FreshnessBucket;
    evidence_quality: "official" | "news" | "analyst" | "rumor";
  }>,
): number {
  if (signals.length === 0) return 0;

  // Evidence quality 보정 계수
  const qualityMultiplier: Record<string, number> = {
    official: 1.0,   // IR/공시/공식 발표
    news:     0.8,   // 일반 뉴스
    analyst:  0.7,   // 애널리스트 리포트
    rumor:    0.3,   // 루머/미확인
  };

  const rawDelta = signals.reduce((sum, s) => {
    const freshWeight = getFreshnessWeight(s.freshness_bucket);
    const qualWeight = qualityMultiplier[s.evidence_quality] ?? 0.5;
    return sum + s.impact_score * freshWeight * qualWeight;
  }, 0);

  // 신호 수가 많을수록 개별 영향 희석 (log 감쇠)
  const dampened = rawDelta / Math.max(1, Math.log2(signals.length + 1));

  return clamp(dampened, -5, 5);
}

/**
 * Freshness bucket 판별 (event_date 기준)
 * 
 * DB의 refresh_signal_freshness() 함수와 동일한 로직.
 * 클라이언트에서 실시간 판별 시 사용.
 */
export function determineFreshnessBucket(eventDate: Date, now: Date = new Date()): FreshnessBucket {
  const diffMs = now.getTime() - eventDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 7) return "7d";
  if (diffDays <= 30) return "30d";
  if (diffDays <= 90) return "90d";
  return "stale";
}

