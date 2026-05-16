// ========================================
// INSTITUTIONAL BOT WORKER (STEP 5)
// Multi-user SMC execution engine
// ========================================

const { calculateSMC } = require("../engine/smcEngine");
const { executeTrade } = require("../engine/tradeExecutor");
const { initUser, saveUser } = require("../services/userService");

function startBotWorker({ ws, db, users, marketPrices }) {

    setInterval(async () => {

        try {

            // ================================
            // VALID MARKET DATA CHECK
            // ================================
            if (!marketPrices || marketPrices.length < 30) return;

            const result = calculateSMC(marketPrices);
            if (!result) return;

            // ================================
            // LOOP USERS (MULTI-USER SYSTEM)
            // ================================
            for (const userId of Object.keys(users)) {

                const user = await initUser(db, userId);

                if (!user) continue;

                // ================================
                // BOT STATUS CHECK
                // ================================
                if (!user.botRunning) continue;

                // ================================
                // COOLDOWN SYSTEM
                // ================================
                const now = Date.now();
                const cooldown = user.cooldown || 8000;

                if (user.lastTradeTime && (now - user.lastTradeTime < cooldown)) {
                    continue;
                }

                // ================================
                // CONFIDENCE FILTER
                // ================================
                if (result.confidence < (user.minConfidence || 60)) {
                    continue;
                }

                // ================================
                // USER RISK CONFIG
                // ================================
                const trade = {
                    userId,

                    signal: result.signal,

                    amount: user.tradeAmount || 1,
                    symbol: user.symbol || "R_100",

                    duration: user.duration || 1,
                    durationUnit: user.durationUnit || "t",

                    confidence: result.confidence,

                    status: "OPEN",

                    entry: result.entry,
                    time: Date.now()
                };

                // ================================
                // EXECUTE TRADE (FIXED CALL)
                // ================================
                await executeTrade(userId, result);

                console.log("📤 TRADE SENT:", {
                    userId,
                    signal: result.signal,
                    confidence: result.confidence
                });

                // ================================
                // UPDATE USER STATE
                // ================================
                user.trades = user.trades || [];
                user.trades.push(trade);

                user.totalTrades = (user.totalTrades || 0) + 1;

                user.lastTradeTime = now;
                user.lastSignal = result.signal;
                user.lastConfidence = result.confidence;

                // ================================
                // SAVE USER
                // ================================
                await saveUser(db, userId, user);
            }

        } catch (err) {
            console.log("❌ BOT WORKER ERROR:", err.message);
        }

    }, 4000);
}

module.exports = { startBotWorker };
