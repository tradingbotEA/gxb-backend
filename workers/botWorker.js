const { calculateSMC } = require("../engine/smcEngine");
const { executeTrade } = require("../engine/tradeExecutor");
const { initUser, saveUser } = require("../services/userService");

function startBotWorker({ ws, db, users, marketPrices }) {

    setInterval(async () => {

        for (const userId of Object.keys(users)) {

            const user = await initUser(db, userId);

            if (!user.botRunning) continue;
            if (marketPrices.length < 30) continue;

            const now = Date.now();
            if (now - user.lastTradeTime < 8000) continue;

            const result = calculateSMC(marketPrices);
            if (!result) continue;

            const trade = {
                time: Date.now(),
                ...result,
                symbol: "R_100",
                status: "OPEN"
            };

            // EXECUTE TRADE
            executeTrade(ws, trade);

            // UPDATE USER
            user.trades.push(trade);
            user.totalTrades++;
            user.lastTradeTime = now;
            user.lastSignal = result.signal;
            user.lastConfidence = result.confidence;

            await saveUser(db, userId, user);
        }

    }, 4000);
}

module.exports = { startBotWorker };
