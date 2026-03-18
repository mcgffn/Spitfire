// ══════════════════════════════════════════════════════════════
// SPITFIRE — useSpitfireData hook
// Connects the dashboard UI to Supabase.
// Falls back to empty state if DB is unreachable.
// ══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchOrganizations,
  fetchCompanyDashboard,
  fetchPresets,
} from "@/lib/supabase/queries";
import type {
  Organization,
  CompanyDashboardData,
  SliderPreset,
} from "@/lib/supabase/types";

export interface SpitfireState {
  // Loading
  loading: boolean;
  error: string | null;

  // Data
  organizations: Organization[];
  selectedOrgId: string | null;
  dashboard: CompanyDashboardData | null;
  presets: SliderPreset[];

  // Actions
  selectOrganization: (id: string) => void;
  refresh: () => void;
}

export function useSpitfireData(): SpitfireState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<CompanyDashboardData | null>(null);
  const [presets, setPresets] = useState<SliderPreset[]>([]);

  const supabase = createClient();

  // ── Initial load: org list + presets ──
  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [orgs, presetsData] = await Promise.all([
        fetchOrganizations(supabase),
        fetchPresets(supabase),
      ]);

      setOrganizations(orgs);
      setPresets(presetsData);

      // Auto-select first org
      if (orgs.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgs[0].id);
      }
    } catch (e) {
      console.error("Initial load failed:", e);
      setError("Supabase 연결 실패. .env.local의 URL과 Key를 확인하세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load dashboard for selected org ──
  const loadDashboard = useCallback(
    async (orgId: string) => {
      setLoading(true);
      try {
        const data = await fetchCompanyDashboard(supabase, orgId);
        setDashboard(data);
        setError(null);
      } catch (e) {
        console.error("Dashboard load failed:", e);
        setError("기업 데이터 로드 실패.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── Effects ──
  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (selectedOrgId) {
      loadDashboard(selectedOrgId);
    }
  }, [selectedOrgId, loadDashboard]);

  // ── Actions ──
  const selectOrganization = useCallback((id: string) => {
    setSelectedOrgId(id);
  }, []);

  const refresh = useCallback(() => {
    if (selectedOrgId) {
      loadDashboard(selectedOrgId);
    }
  }, [selectedOrgId, loadDashboard]);

  return {
    loading,
    error,
    organizations,
    selectedOrgId,
    dashboard,
    presets,
    selectOrganization,
    refresh,
  };
}
