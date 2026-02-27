const express = require("express");

module.exports = (app, stripe, supabaseAdmin) => {
  app.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          endpointSecret
        );
      } catch (err) {
        console.error("❌ Webhook signature verification failed:", err.message);
        return res.sendStatus(400);
      }

      console.log("🔥 Evento:", event.type);

      // ==============================
      // Helpers
      // ==============================

      const priceIdToPlan = (priceId) => {
        if (!priceId) return null;

        if (priceId === process.env.STRIPE_PRICE_ESSENTIAL) return "Essential";
        if (priceId === process.env.STRIPE_PRICE_GROWTH) return "Growth";
        if (priceId === process.env.STRIPE_PRICE_ELITE) return "Elite";

        return "Unknown";
      };

      const safeIsoFromUnixSeconds = (unixSeconds) => {
        if (unixSeconds == null) return null;
        const d = new Date(unixSeconds * 1000);
        if (Number.isNaN(d.getTime())) return null;
        return d.toISOString();
      };

      // ==============================
      // SUA LÓGICA COMPLETA AQUI
      // (cole o conteúdo que já está funcionando)
      // ==============================

      return res.sendStatus(200);
    }
  );
};
