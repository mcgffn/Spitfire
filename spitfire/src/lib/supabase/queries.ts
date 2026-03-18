// ══════════════════════════════════════════════════════════════
// SPITFIRE — Supabase Query Layer
// All data fetching lives here. Components never call Supabase directly.
// ══════════════════════════════════════════════════════════════

import { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Organization,
  OrganizationProfile,
  Signal,
  SliderPreset,
  OrganizationKtIntersection,
  AxisScoreData,
  CompanyDashboardData,
} from "./types";

type Client = SupabaseClient<Database>;

// ── Short name mapping for 8 axes ──
const AXIS_SHORT_NAMES: Record<string, string> = {
  strategic_alignment: "전략 정합",
  capability_complementarity: "역량 보완",
  monetization_clarity: "수익화 명확",
  execution_readiness: "실행 준비",
  control_dependency: "통제 리스크",
  market_access: "시장 접근",
  internal_compatibility: "내부 적합",
  timing_urgency: "타이밍",
};

// ══════════════════════════════════════════════════════════════
// 1. Organization List (Company Selector에서 사용)
// ══════════════════════════════════════════════════════════════

export async function fetchOrganizations(client: Client): Promise<Organization[]> {
  const { data, error } = await client
    .from("organizations")
    .select("*")
    .eq("status", "active")
    .order("name");

  if (error) {
    console.error("fetchOrganizations error:", error);
    return [];
  }
  return data || [];
}

// ══════════════════════════════════════════════════════════════
// 2. Company Dashboard Data (선택된 기업의 전체 데이터)
// ══════════════════════════════════════════════════════════════

export async function fetchCompanyDashboard(
  client: Client,
  organizationId: string
): Promise<CompanyDashboardData | null> {
  // Parallel fetch — 4 queries at once
  const [orgResult, profileResult, scoresResult, signalsResult, intersectionsResult] =
    await Promise.all([
      // Organization
      client
        .from("organizations")
        .select("*")
        .eq("id", organizationId)
        .single(),

      // Current profile
      client
        .from("organization_profiles")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_current", true)
        .single(),

      // Scores with dimension info (JOIN)
      client
        .from("organization_scores")
        .select("*, scoring_dimensions(*)")
        .eq("organization_id", organizationId)
        .order("scoring_dimensions(display_order)"),

      // Recent signals (not stale)
      client
        .from("signals")
        .select("*")
        .eq("organization_id", organizationId)
        .neq("freshness_bucket", "stale")
        .order("event_date", { ascending: false })
        .limit(20),

      // KT intersections with node info
      client
        .from("organization_kt_intersections")
        .select("*, kt_value_chain_nodes(*)")
        .eq("organization_id", organizationId),
    ]);

  if (orgResult.error || !orgResult.data) {
    console.error("fetchCompanyDashboard org error:", orgResult.error);
    return null;
  }

  // Transform scores into AxisScoreData[]
  const scores: AxisScoreData[] = (scoresResult.data || []).map((s: any) => {
    const dim = s.scoring_dimensions;
    return {
      dimensionKey: dim?.key || "",
      dimensionName: dim?.name || "",
      shortName: AXIS_SHORT_NAMES[dim?.key || ""] || dim?.name || "",
      structuralScore: s.structural_score,
      eventDelta: s.event_delta_score,
      manualDelta: s.manual_override_delta || 0,
      finalScore: s.final_score,
      confidence: s.confidence_score,
      isRisk: dim?.is_risk_dimension || false,
      floorThreshold: dim?.floor_threshold || null,
      displayOrder: dim?.display_order || 0,
    };
  });

  // Overall confidence = average of per-axis confidence
  const confidence =
    scores.length > 0
      ? scores.reduce((sum, s) => sum + s.confidence, 0) / scores.length
      : 0;

  return {
    organization: orgResult.data,
    profile: profileResult.data || null,
    scores,
    signals: signalsResult.data || [],
    intersections: (intersectionsResult.data || []) as OrganizationKtIntersection[],
    confidence,
  };
}

// ══════════════════════════════════════════════════════════════
// 3. Slider Presets
// ══════════════════════════════════════════════════════════════

export async function fetchPresets(client: Client): Promise<SliderPreset[]> {
  const { data, error } = await client
    .from("slider_presets")
    .select("*")
    .order("is_system", { ascending: false })
    .order("name");

  if (error) {
    console.error("fetchPresets error:", error);
    return [];
  }
  return data || [];
}

// ══════════════════════════════════════════════════════════════
// 4. Signals for a specific company
// ══════════════════════════════════════════════════════════════

export async function fetchSignals(
  client: Client,
  organizationId: string,
  freshnessBucket?: string
): Promise<Signal[]> {
  let query = client
    .from("signals")
    .select("*")
    .eq("organization_id", organizationId)
    .order("event_date", { ascending: false })
    .limit(50);

  if (freshnessBucket) {
    query = query.eq("freshness_bucket", freshnessBucket);
  } else {
    query = query.neq("freshness_bucket", "stale");
  }

  const { data, error } = await query;
  if (error) {
    console.error("fetchSignals error:", error);
    return [];
  }
  return data || [];
}
