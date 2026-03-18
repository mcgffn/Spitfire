// ══════════════════════════════════════════════════════════════
// SPITFIRE — Supabase Database Types
// Auto-generate later with: npx supabase gen types typescript
// For now, manual types matching seed_pilot_companies.sql
// ══════════════════════════════════════════════════════════════

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Organization, "id">>;
      };
      organization_profiles: {
        Row: OrganizationProfile;
        Insert: Omit<OrganizationProfile, "id" | "created_at">;
        Update: Partial<Omit<OrganizationProfile, "id">>;
      };
      scoring_dimensions: {
        Row: ScoringDimension;
        Insert: Omit<ScoringDimension, "id">;
        Update: Partial<Omit<ScoringDimension, "id">>;
      };
      organization_scores: {
        Row: OrganizationScore;
        Insert: Omit<OrganizationScore, "id" | "computed_at">;
        Update: Partial<Omit<OrganizationScore, "id">>;
      };
      signals: {
        Row: Signal;
        Insert: Omit<Signal, "id" | "created_at">;
        Update: Partial<Omit<Signal, "id">>;
      };
      slider_presets: {
        Row: SliderPreset;
        Insert: Omit<SliderPreset, "id">;
        Update: Partial<Omit<SliderPreset, "id">>;
      };
      kt_value_chain_nodes: {
        Row: KtValueChainNode;
        Insert: Omit<KtValueChainNode, "id">;
        Update: Partial<Omit<KtValueChainNode, "id">>;
      };
      organization_kt_intersections: {
        Row: OrganizationKtIntersection;
        Insert: Omit<OrganizationKtIntersection, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<OrganizationKtIntersection, "id">>;
      };
      simulation_runs: {
        Row: SimulationRun;
        Insert: Omit<SimulationRun, "id" | "created_at">;
        Update: Partial<Omit<SimulationRun, "id">>;
      };
      recommendations: {
        Row: Recommendation;
        Insert: Omit<Recommendation, "id" | "created_at">;
        Update: Partial<Omit<Recommendation, "id">>;
      };
      manual_overrides: {
        Row: ManualOverride;
        Insert: Omit<ManualOverride, "id" | "created_at">;
        Update: Partial<Omit<ManualOverride, "id">>;
      };
      profiles: {
        Row: Profile;
        Insert: Profile;
        Update: Partial<Profile>;
      };
    };
  };
};

// ── Row Types ──

export interface Organization {
  id: string;
  name: string;
  ticker: string | null;
  country: string | null;
  industry: string | null;
  business_layer: string | null;
  short_description: string | null;
  status: "active" | "archived" | "pending";
  created_at: string;
  updated_at: string;
}

export interface OrganizationProfile {
  id: string;
  organization_id: string;
  business_model_summary: string | null;
  core_assets: string | null;
  revenue_model: string | null;
  customer_segments: string | null;
  geographic_focus: string | null;
  ecosystem_position: string | null;
  dependency_summary: string | null;
  source_note: string | null;
  version: number;
  is_current: boolean;
  created_at: string;
}

export interface ScoringDimension {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_risk_dimension: boolean;
  floor_threshold: number | null;
  display_order: number;
}

export interface OrganizationScore {
  id: string;
  organization_id: string;
  dimension_id: string;
  structural_score: number;
  event_delta_score: number;
  manual_override_delta: number;
  final_score: number;
  confidence_score: number;
  contributing_signal_ids: string[];
  computed_at: string;
  // Joined fields (from queries)
  scoring_dimensions?: ScoringDimension;
}

export interface Signal {
  id: string;
  organization_id: string;
  source_url: string | null;
  headline: string;
  event_type: string | null;
  event_date: string | null;
  target_axis: string | null;
  impact_score: number;
  kt_relevance_score: number | null;
  summary: string | null;
  evidence_quality: "official" | "news" | "analyst" | "rumor";
  freshness_bucket: "7d" | "30d" | "90d" | "stale";
  created_at: string;
}

export interface SliderPreset {
  id: string;
  name: string;
  description: string | null;
  weights_json: Record<string, number>;
  is_system: boolean;
  created_by: string | null;
}

export interface KtValueChainNode {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
}

export interface OrganizationKtIntersection {
  id: string;
  organization_id: string;
  kt_node_id: string;
  intersection_type: "amplify" | "complement" | "collide" | "substitute";
  strength_score: number | null;
  summary: string | null;
  source_type: "manual" | "ai" | "hybrid";
  created_at: string;
  updated_at: string;
  // Joined
  kt_value_chain_nodes?: KtValueChainNode;
}

export interface SimulationRun {
  id: string;
  organization_id: string;
  user_id: string;
  preset_id: string | null;
  slider_state_json: Record<string, number>;
  dimension_results_json: Record<string, unknown>[];
  result_stance: string;
  result_confidence: number;
  human_override_stance: string | null;
  user_memo: string | null;
  created_at: string;
}

export interface Recommendation {
  id: string;
  simulation_run_id: string;
  stance: string;
  engagement_model: string | null;
  partnership_thesis: string | null;
  red_team_warnings: Record<string, unknown>[];
  why_not_now: string | null;
  meeting_questions: Record<string, unknown>[];
  recommended_owner_team: string | null;
  decision_preconditions: string | null;
  created_at: string;
}

export interface ManualOverride {
  id: string;
  organization_id: string;
  dimension_id: string;
  user_id: string;
  old_value: number | null;
  new_value: number | null;
  reason: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  team: string | null;
  role: "analyst" | "manager" | "executive" | "admin";
  created_at: string;
}

// ── Derived Types (for UI) ──

export interface CompanyDashboardData {
  organization: Organization;
  profile: OrganizationProfile | null;
  scores: AxisScoreData[];
  signals: Signal[];
  intersections: OrganizationKtIntersection[];
  confidence: number;
}

export interface AxisScoreData {
  dimensionKey: string;
  dimensionName: string;
  shortName: string;
  structuralScore: number;
  eventDelta: number;
  manualDelta: number;
  finalScore: number;
  confidence: number;
  isRisk: boolean;
  floorThreshold: number | null;
  displayOrder: number;
}
