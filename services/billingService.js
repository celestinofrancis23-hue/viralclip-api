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

module.exports = {
  consumeCreditsOrThrow,
};
