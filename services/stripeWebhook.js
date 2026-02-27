// stripeWebhook.js (CommonJS)

module.exports = function registerStripeWebhook(app, stripe, supabaseAdmin) {
  // ------------------------------
  // Helpers
  // ------------------------------
  const priceIdToPlan = (priceId) => {
    if (!priceId) return null;

    if (priceId === process.env.STRIPE_PRICE_ESSENTIAL) return "Essential";
    if (priceId === process.env.STRIPE_PRICE_GROWTH) return "Growth Plus";
    if (priceId === process.env.STRIPE_PRICE_ELITE) return "Elite";

    return "Unknown";
  };

  // ✅ PASSO 1: Diferenciar planos aqui
  const planToMonthlyCredits = (plan) => {
    // créditos = número de "sermões/links" por mês
    if (plan === "Essential") return 4;
    if (plan === "Growth Plus") return 8;
    if (plan === "Elite") return 16;

    // Unknown / null -> 0 para não liberar uso
    return 0;
  };

  const safeIsoFromUnixSeconds = (unixSeconds) => {
    if (!unixSeconds) return null;
    const d = new Date(unixSeconds * 1000);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  // ==============================
  // STRIPE WEBHOOK (ANTES do express.json())
  // ==============================
  app.post("/webhook", require("express").raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.sendStatus(400);
    }

    console.log("🔥 Evento:", event.type);

    try {
      // ==========================================
      // 1) CHECKOUT COMPLETED (cria/upsert inicial)
      // ==========================================
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        const userId = session?.metadata?.userId; // seu UUID do Supabase Auth
        const stripeSubscriptionId = session?.subscription;
        const stripeCustomerId = session?.customer;

        if (!userId || !stripeSubscriptionId) {
          console.error("❌ userId ou stripeSubscriptionId ausente no checkout.session.completed");
          return res.sendStatus(200);
        }

        // Fonte de verdade: Stripe Subscription
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

        const priceId = subscription?.items?.data?.[0]?.price?.id || null;
        const status = subscription?.status || "active";
        const currentPeriodEnd = safeIsoFromUnixSeconds(subscription?.current_period_end);

        const planName = priceIdToPlan(priceId);
        const creditTotal = planToMonthlyCredits(planName);

        console.log("✅ Upsert assinatura (checkout):", {
          userId,
          planName,
          creditTotal,
          priceId,
          stripeSubscriptionId,
        });

        // ✅ aqui diferenciamos os planos: set credit_total
        const { error } = await supabaseAdmin
          .from("subscriptions")
          .upsert(
            {
              user_id: userId,
              stripe_subscription_id: stripeSubscriptionId,
              stripe_customer_id: stripeCustomerId,
              stripe_price_id: priceId,
              plan: planName,
              status,
              current_period_end: currentPeriodEnd,

              // ✅ PASSO 1: define créditos por plano
              credit_total: creditTotal,

              // opcional: ao iniciar assinatura, zera uso
              credit_used: 0,

              updated_at: new Date().toISOString(),
            },
            { onConflict: "stripe_subscription_id" }
          );

        if (error) console.error("❌ Erro Supabase (checkout upsert):", error);
        else console.log("✅ Assinatura salva/atualizada (checkout)");
      }

      // ==================================================
      // 2) SUBSCRIPTION UPDATED (mudança de plano/status)
      // ==================================================
      if (event.type === "customer.subscription.updated") {
        const subscription = event.data.object;

        const stripeSubscriptionId = subscription?.id;
        if (!stripeSubscriptionId) return res.sendStatus(200);

        const priceId = subscription?.items?.data?.[0]?.price?.id || null;
        const status = subscription?.status || null;
        const currentPeriodEnd = safeIsoFromUnixSeconds(subscription?.current_period_end);

        const planName = priceIdToPlan(priceId);
        const creditTotal = planToMonthlyCredits(planName);

        console.log("🔄 subscription.updated:", stripeSubscriptionId, planName, creditTotal);

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            stripe_price_id: priceId,
            plan: planName,
            status,
            current_period_end: currentPeriodEnd,

            // ✅ se mudar de plano, atualiza o teto
            credit_total: creditTotal,

            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", stripeSubscriptionId);

        if (error) console.error("❌ Erro Supabase (subscription.updated):", error);
        else console.log("✅ Assinatura atualizada (subscription.updated)");
      }

      // =================================
      // 3) CANCELAMENTO
      // =================================
      if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;

        const stripeSubscriptionId = subscription?.id;
        if (!stripeSubscriptionId) return res.sendStatus(200);

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", stripeSubscriptionId);

        if (error) console.error("❌ Erro cancelamento:", error);
        else console.log("✅ Assinatura marcada como canceled");
      }

      // ==============================
      // 4) FALHA DE PAGAMENTO
      // ==============================
      if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object;
        const stripeSubscriptionId = invoice?.subscription;
        if (!stripeSubscriptionId) return res.sendStatus(200);

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", stripeSubscriptionId);

        if (error) console.error("❌ Erro past_due:", error);
        else console.log("✅ Assinatura marcada como past_due");
      }

      // ==============================
      // ✅ RENOVAÇÃO DO MÊS (RESET DE CRÉDITOS)
      // ==============================
      if (event.type === "invoice.payment_succeeded") {
        const invoice = event.data.object;

        const stripeSubscriptionId = invoice?.subscription;

        // Alguns invoices não têm subscription (ex: one-off invoice)
        if (!stripeSubscriptionId) {
          console.log("ℹ️ invoice.payment_succeeded sem subscription (ignorado)");
          return res.sendStatus(200);
        }

        // Puxa subscription atualizada do Stripe
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

        const priceId = subscription?.items?.data?.[0]?.price?.id || null;
        const planName = priceIdToPlan(priceId);
        const creditTotal = planToMonthlyCredits(planName);

        const currentPeriodEnd = safeIsoFromUnixSeconds(subscription?.current_period_end);

        console.log("🔁 Renovação paga → reset créditos:", stripeSubscriptionId, planName, creditTotal);

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "active",
            current_period_end: currentPeriodEnd,

            // ✅ RESET mensal (muito importante)
            credit_total: creditTotal,
            credit_used: 0,

            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", stripeSubscriptionId);

        if (error) console.error("❌ Erro renewal reset:", error);
        else console.log("✅ Créditos resetados + assinatura active");
      }
    } catch (err) {
      console.error("❌ Erro interno webhook:", err);
    }

    return res.sendStatus(200);
  });
};
