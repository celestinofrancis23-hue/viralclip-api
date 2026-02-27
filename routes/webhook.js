const express = require("express");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ⚠️ IMPORTANTE: usar raw body
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log("Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 🎯 EVENTO PRINCIPAL
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const userId = session.metadata.userId;

      const subscription = await stripe.subscriptions.retrieve(
        session.subscription
      );

      await supabase.from("subscriptions").insert({
        user_id: userId,
        stripe_customer_id: session.customer,
        stripe_subscription_id: subscription.id,
        stripe_price_id: subscription.items.data[0].price.id,
        plan: subscription.items.data[0].price.nickname?.toLowerCase(),
        status: subscription.status,
        current_period_end: new Date(
          subscription.current_period_end * 1000
        ),
        credit_total: 12, // ajuste depois por plano
      });
    }

    res.json({ received: true });
  }
);

module.exports = router;
