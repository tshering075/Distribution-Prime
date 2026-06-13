/**
 * Supabase persistence for distributor POS sales and settings.
 */

import { supabase } from "../supabase";
import { getActiveOrganizationSlug } from "./tenantScope";
import { getDistributorSessionToken } from "../utils/distributorSession";
import { firstRow } from "../utils/supabaseRows";
import { fromTenant } from "./supabaseService";

function isMissingRpcError(error) {
  const code = error?.code;
  const msg = String(error?.message || "");
  return code === "PGRST202" || code === "42883" || /function.*does not exist/i.test(msg);
}

function isMissingTableError(error) {
  const msg = String(error?.message || "");
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    /distributor_pos_sales/i.test(msg)
  );
}

function distributorRpcContext(distributorCode) {
  const slug = getActiveOrganizationSlug();
  const code = String(distributorCode || "").trim();
  const sessionToken = getDistributorSessionToken();
  if (!slug || !code || !sessionToken) return null;
  return { slug, code, sessionToken };
}

/** Normalize DB row → app sale record. */
export function posSaleRowToRecord(row) {
  if (!row) return null;
  const data =
    row.sale_data && typeof row.sale_data === "object"
      ? row.sale_data
      : row.saleData && typeof row.saleData === "object"
        ? row.saleData
        : {};
  return {
    ...data,
    id: data.id || row.id,
    saleNumber: data.saleNumber || row.sale_number || row.saleNumber,
    invoiceNumber: data.invoiceNumber || row.invoice_number || row.invoiceNumber,
    distributorCode: data.distributorCode || row.distributor_code || row.distributorCode,
    createdAt: data.createdAt || row.created_at || row.createdAt,
  };
}

export async function insertPosSaleToSupabase(distributorCode, saleRecord) {
  if (!supabase) throw new Error("Supabase not initialized");
  const ctx = distributorRpcContext(distributorCode);
  if (!ctx) {
    throw new Error("Distributor session required to save POS sale");
  }

  const { data, error } = await supabase.rpc("insert_distributor_pos_sale", {
    p_slug: ctx.slug,
    p_distributor_code: ctx.code,
    p_session_token: ctx.sessionToken,
    p_sale: saleRecord,
  });

  if (error) {
    if (isMissingRpcError(error) || isMissingTableError(error)) {
      const err = new Error("POS sales table or RPC not found in Supabase");
      err.code = error.code;
      throw err;
    }
    throw error;
  }

  return posSaleRowToRecord(data);
}

export async function fetchPosSalesFromSupabase(distributorCode, { fromDate, toDate } = {}) {
  if (!supabase) return [];

  const ctx = distributorRpcContext(distributorCode);
  if (ctx) {
    const { data, error } = await supabase.rpc("get_distributor_pos_sales", {
      p_slug: ctx.slug,
      p_distributor_code: ctx.code,
      p_session_token: ctx.sessionToken,
      p_from_date: fromDate ? String(fromDate).slice(0, 10) : null,
      p_to_date: toDate ? String(toDate).slice(0, 10) : null,
    });

    if (error) {
      if (isMissingRpcError(error) || isMissingTableError(error)) return [];
      throw error;
    }

    return (Array.isArray(data) ? data : []).map(posSaleRowToRecord).filter(Boolean);
  }

  try {
    let query = fromTenant("distributor_pos_sales")
      .select("*")
      .eq("distributor_code", String(distributorCode || "").trim())
      .order("created_at", { ascending: false });

    if (fromDate) {
      query = query.gte("created_at", `${String(fromDate).slice(0, 10)}T00:00:00`);
    }
    if (toDate) {
      query = query.lte("created_at", `${String(toDate).slice(0, 10)}T23:59:59`);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
    return (data || []).map(posSaleRowToRecord).filter(Boolean);
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

export async function deletePosSaleFromSupabase(distributorCode, saleId) {
  if (!supabase) throw new Error("Supabase not initialized");
  const id = String(saleId || "").trim();
  if (!id) throw new Error("Sale id is required");

  const ctx = distributorRpcContext(distributorCode);
  if (ctx) {
    const { data, error } = await supabase.rpc("delete_distributor_pos_sale", {
      p_slug: ctx.slug,
      p_distributor_code: ctx.code,
      p_session_token: ctx.sessionToken,
      p_sale_id: id,
    });

    if (error) {
      if (isMissingRpcError(error) || isMissingTableError(error)) {
        const err = new Error("delete_distributor_pos_sale RPC not found in Supabase");
        err.code = error.code;
        throw err;
      }
      throw error;
    }

    return Boolean(data);
  }

  const { error } = await fromTenant("distributor_pos_sales").delete().eq("id", id);
  if (error) {
    if (isMissingTableError(error)) return false;
    throw error;
  }
  return true;
}

export async function fetchPosInvoiceNumbersInTenant(distributorCode) {
  if (!supabase) return [];
  const numbers = new Set();

  const ctx = distributorRpcContext(distributorCode);
  if (ctx) {
    try {
      const sales = await fetchPosSalesFromSupabase(distributorCode);
      for (const sale of sales) {
        if (sale?.invoiceNumber) numbers.add(sale.invoiceNumber);
      }
    } catch (error) {
      console.warn("Could not load distributor POS invoice numbers:", error);
    }
  }

  try {
    const { data, error } = await fromTenant("distributor_pos_sales")
      .select("invoice_number")
      .not("invoice_number", "is", null);
    if (!error) {
      for (const row of data || []) {
        if (row?.invoice_number) numbers.add(row.invoice_number);
      }
      return Array.from(numbers);
    }
    if (isMissingTableError(error)) return Array.from(numbers);
    throw error;
  } catch (error) {
    if (isMissingTableError(error)) return Array.from(numbers);
    console.warn("Could not load POS invoice numbers from Supabase:", error);
    return Array.from(numbers);
  }
}

export async function savePhysicalStockToSupabase(distributorCode, physicalStockPayload) {
  if (!supabase) throw new Error("Supabase not initialized");

  const ctx = distributorRpcContext(distributorCode);
  if (ctx) {
    const { data, error } = await supabase.rpc("update_distributor_physical_stock", {
      p_slug: ctx.slug,
      p_distributor_code: ctx.code,
      p_session_token: ctx.sessionToken,
      p_physical_stock: physicalStockPayload,
    });

    if (error) {
      if (isMissingRpcError(error)) {
        const err = new Error("update_distributor_physical_stock RPC not found");
        err.code = error.code;
        throw err;
      }
      throw error;
    }

    const row = firstRow(Array.isArray(data) ? data : data ? [data] : []);
    return row || { physical_stock: physicalStockPayload };
  }

  const { updateDistributor } = await import("./supabaseService");
  return updateDistributor(distributorCode, { physical_stock: physicalStockPayload });
}

/**
 * Upsert historical snapshot via distributor session RPC (anon-safe).
 * Returns null when no distributor session — caller should use admin upsert path.
 */
export async function savePhysicalStockSnapshotToSupabase(distributorCode, payload) {
  if (!supabase) throw new Error("Supabase not initialized");

  const ctx = distributorRpcContext(distributorCode);
  if (!ctx) return null;

  const reportDate =
    typeof payload?.reportDate === "string" && payload.reportDate
      ? payload.reportDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("upsert_distributor_physical_stock_snapshot", {
    p_slug: ctx.slug,
    p_distributor_code: ctx.code,
    p_session_token: ctx.sessionToken,
    p_report_date: reportDate,
    p_payload: {
      reportDate,
      rows: payload?.rows ?? [],
      updatedAt: payload?.updatedAt || new Date().toISOString(),
    },
  });

  if (error) {
    if (isMissingRpcError(error)) {
      const err = new Error("upsert_distributor_physical_stock_snapshot RPC not found");
      err.code = error.code;
      throw err;
    }
    if (error.code === "42P01" || /distributor_physical_stock_snapshots/i.test(String(error.message || ""))) {
      const err = new Error(
        "Table distributor_physical_stock_snapshots is missing. Run ADD_DISTRIBUTOR_PHYSICAL_STOCK_SNAPSHOTS.sql in Supabase."
      );
      err.code = "MISSING_SNAPSHOTS_TABLE";
      throw err;
    }
    throw error;
  }

  return firstRow(Array.isArray(data) ? data : data ? [data] : []);
}

export async function savePosSettingsToSupabase(distributorCode, settings) {
  if (!supabase) throw new Error("Supabase not initialized");

  const ctx = distributorRpcContext(distributorCode);
  if (ctx) {
    const { data, error } = await supabase.rpc("update_distributor_pos_settings", {
      p_slug: ctx.slug,
      p_distributor_code: ctx.code,
      p_session_token: ctx.sessionToken,
      p_settings: settings,
    });

    if (error) {
      if (isMissingRpcError(error)) {
        const err = new Error("update_distributor_pos_settings RPC not found");
        err.code = error.code;
        throw err;
      }
      throw error;
    }

    const row = firstRow(Array.isArray(data) ? data : data ? [data] : []);
    return row?.pos_settings ?? row?.posSettings ?? settings;
  }

  const { updateDistributor } = await import("./supabaseService");
  const updated = await updateDistributor(distributorCode, { pos_settings: settings });
  return updated?.pos_settings ?? updated?.posSettings ?? settings;
}
