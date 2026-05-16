// ========================================
// INSTITUTIONAL TRADE EXECUTOR (STEP 5)
// Multi-user + SMC-ready + Deriv-safe
// ========================================

async function executeTrade(userId, signal) {

    try {

        // ================================
        // USER FETCH
        // ================================
        const userRef = db.collection("users").doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            console.log("❌ USER NOT FOUND:", userId);
            return;
        }

        const user = userSnap.data();

        // ================================
        // BOT ENABLE CHECK
        // ================================
        if (!user.botRunning) {
            console.log("⛔ BOT DISABLED FOR USER:", userId);
            return;
        }

        // ================================
        // DERIV CONNECTION CHECK
        // ================================
        if (!ws || ws.readyState !== 1) {
            console.log("❌ DERIV WS NOT CONNECTED");
            return;
        }

        // ================================
        // COOLDOWN CONTROL
        // ================================
        const now = Date.now();
        const cooldown = user.cooldown || 8000;

        if (user.lastTradeTime && (now - user.lastTradeTime < cooldown)) {
            console.log("⏳ COOLDOWN ACTIVE:", userId);
            return;
        }

        // ================================
        // RISK SETTINGS (USER BASED)
        // ================================
        const tradeAmount = user.tradeAmount || 1;
        const tradeSymbol = user.symbol || "R_100";
        const duration = user.duration || 1;
        const durationUnit = user.durationUnit || "t";

        // ================================
        // CONFIDENCE FROM SMC SIGNAL
        // ================================
        const confidence = signal.confidence || 80;

        // Optional: block weak signals
        if (confidence < 60) {
            console.log("⚠️ LOW CONFIDENCE TRADE BLOCKED");
            return;
        }

        // ================================
        // TRADE OBJECT
        // ================================
        const trade = {
            userId,
            signal: signal.signal,

            amount: tradeAmount,
            symbol: tradeSymbol,

            duration,
            durationUnit,

            status: "PENDING",

            confidence,

            createdAt: now,

            result: null,
            profit: 0
        };

        // ================================
        // STORE LAST TRADE MEMORY
        // ================================
        memory.lastTrade = trade;

        console.log("📤 SENDING PROPOSAL:", trade);

        // ================================
        // DERIV PROPOSAL REQUEST
        // ================================
        ws.send(JSON.stringify({
            proposal: 1,
            amount: trade.amount,
            basis: "stake",
            contract_type: trade.signal,
            currency: "USD",
            duration: trade.duration,
            duration_unit: trade.durationUnit,
            symbol: trade.symbol
        }));

        // ================================
        // UPDATE USER STATS
        // ================================
        user.lastTradeTime = now;
        user.totalTrades = (user.totalTrades || 0) + 1;

        user.lastConfidence = confidence;

        // ================================
        // SAVE USER STATE
        // ================================
        await userRef.set(user, { merge: true });

        console.log("✅ TRADE SENT SUCCESSFULLY");

    } catch (err) {
        console.log("❌ EXECUTE TRADE ERROR:", err.message);
    }
}

module.exports = { executeTrade };
