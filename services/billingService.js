async function consumeCreditsOrThrow(supabaseAdmin, userId, cost = 1) {
  const { data, error } = await supabaseAdmin.rpc("consume_credits", {
    p_user_id: userId,
    p_cost: cost,
  });

  if (error) {
    console.error("❌ RPC consume_credits error:", error);
    throw new Error("billing_error");
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result?.ok) {
    const reason = result?.reason || "not_allowed";
    const remaining = result?.remaining ?? null;
    const e = new Error(reason);
    e.code = reason;
    e.remaining = remaining;
    throw e;
  }

  return result;
}

// Verifica se o utilizador tem créditos suficientes SEM descontar.
// Lê directamente a tabela subscriptions (credit_total - credit_used >= cost).
async function checkCreditsOrThrow(supabaseAdmin, userId, cost = 1) {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("status, credit_total, credit_used")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("❌ checkCreditsOrThrow query error:", error);
    throw new Error("billing_error");
  }

  if (!data) {
    const e = new Error("no_active_subscription");
    e.code = "no_active_subscription";
    e.remaining = 0;
    throw e;
  }

  if (data.status !== "active") {
    const e = new Error("no_active_subscription");
    e.code = "no_active_subscription";
    e.remaining = 0;
    throw e;
  }

  const remaining = (data.credit_total ?? 0) - (data.credit_used ?? 0);

  if (remaining < cost) {
    const e = new Error("insufficient_credits");
    e.code = "insufficient_credits";
    e.remaining = remaining;
    throw e;
  }

  return { ok: true, remaining };
}

// Verifica apenas se o utilizador tem subscrição activa, sem contar créditos.
// Usar quando o frontend já descontou os créditos e o backend só precisa
// de confirmar que o utilizador tem acesso.
async function checkSubscriptionOrThrow(supabaseAdmin, userId) {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("❌ checkSubscriptionOrThrow query error:", error);
    throw new Error("billing_error");
  }

  if (!data || data.status !== "active") {
    const e = new Error("no_active_subscription");
    e.code = "no_active_subscription";
    throw e;
  }

  return { ok: true };
}

module.exports = {
  consumeCreditsOrThrow,
  checkCreditsOrThrow,
  checkSubscriptionOrThrow,
};
