// ========================================
// EXECUTE TRADE FUNCTION
// ========================================

async function executeTrade(userId, signal) {

    try {

        // ====================================
        // FIRESTORE USER REFERENCE
        // ====================================

        const userRef = db.collection("users").doc(userId);

        const userSnap = await userRef.get();

        // ====================================
        // USER EXISTS CHECK
        // ====================================

        if (!userSnap.exists) {

            console.log("❌ USER NOT FOUND:", userId);

            return;
        }

        // ====================================
        // USER DATA
        // ====================================

        const user = userSnap.data();

        // ====================================
        // BOT STATUS CHECK
        // ====================================

        if (!user.botRunning) {

            console.log("⛔ BOT STOPPED:", userId);

            return;
        }

        // ====================================
        // WEBSOCKET CHECK
        // ====================================

        if (!ws || ws.readyState !== 1) {

            console.log("❌ DERIV WS OFFLINE");

            return;
        }

        // ====================================
        // COOLDOWN SYSTEM
        // ====================================

        const now = Date.now();

        const cooldown = 8000;

        if (!user.lastTradeTime) {
            user.lastTradeTime = 0;
        }

        const remainingCooldown =
            now - user.lastTradeTime;

        if (remainingCooldown < cooldown) {

            console.log("⏳ COOLDOWN ACTIVE");

            return;
        }

        // ====================================
        // USER RISK SETTINGS
        // ====================================

        const tradeAmount =
            user.tradeAmount || 1;

        const tradeSymbol =
            user.symbol || "R_100";

        const tradeDuration =
            user.duration || 1;

        const tradeDurationUnit =
            user.durationUnit || "t";

        // ====================================
        // TRADE OBJECT
        // ====================================

        const trade = {

            // USER
            userId: userId,

            // STRATEGY
            signal: signal,

            // TRADE CONFIG
            amount: tradeAmount,
            symbol: tradeSymbol,

            duration: tradeDuration,
            durationUnit: tradeDurationUnit,

            // STATUS
            status: "PENDING",

            // ANALYTICS
            confidence:
                user.lastConfidence || 80,

            // TIME
            createdAt: now,

            // RESULTS
            profit: 0,
            result: null
        };

        // ====================================
        // SAVE TEMP MEMORY
        // ====================================

        memory.lastTrade = trade;

        console.log("📤 REQUESTING PROPOSAL:", trade);

        // ====================================
        // DERIV PROPOSAL REQUEST
        // ====================================

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

        // ====================================
        // UPDATE USER STATS
        // ====================================

        user.lastTradeTime = now;

        if (!user.totalTrades) {
            user.totalTrades = 0;
        }

        user.totalTrades += 1;

        // ====================================
        // SAVE USER
        // ====================================

        await userRef.set(user, {
            merge: true
        });

        console.log("✅ TRADE EXECUTION STARTED");

    } catch (err) {

        console.log(
            "❌ EXECUTE TRADE ERROR:",
            err.message
        );
    }
    }
