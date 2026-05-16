// ========================================
// INSTITUTIONAL DERIV BOT ENGINE (STEP 5)
// Multi-user + SMC-ready + scalable
// ========================================

const WebSocket = require("ws");

class DerivBot {
    constructor(token) {

        this.token = token;
        this.ws = null;

        this.isAuthorized = false;

        this.startHeartbeat();
    }

    // ========================================
    // CONNECT + AUTH
    // ========================================
    connect() {
        return new Promise((resolve, reject) => {

            this.ws = new WebSocket(
                "wss://ws.derivws.com/websockets/v3?app_id=1089"
            );

            // ================================
            // OPEN CONNECTION
            // ================================
            this.ws.on("open", () => {
                console.log("🔌 Connected to Deriv");

                this.ws.send(JSON.stringify({
                    authorize: this.token
                }));
            });

            // ================================
            // MESSAGE HANDLER
            // ================================
            this.ws.on("message", (msg) => {

                let data;

                try {
                    data = JSON.parse(msg);
                } catch (err) {
                    console.log("Invalid JSON:", msg);
                    return;
                }

                // ❌ ERROR HANDLING
                if (data.error) {
                    console.log("❌ Deriv Error:", data.error.message);
                    reject(data.error.message);
                    return;
                }

                // 🔐 AUTH SUCCESS
                if (data.authorize) {
                    this.isAuthorized = true;

                    console.log("✅ Authorized:", data.authorize.loginid);

                    resolve();
                }

                // 💰 PROPOSAL RESPONSE (IMPORTANT FOR STEP 5)
                if (data.proposal) {
                    console.log("📊 Proposal received:", data.proposal.id);
                }

                // 💰 BUY CONFIRMATION
                if (data.buy) {
                    console.log("💰 Trade executed:", data.buy.contract_id);
                }

                // 📉 CONTRACT UPDATE
                if (data.profit_table) {
                    console.log("📊 Profit update received");
                }
            });

            // ================================
            // ERROR HANDLER
            // ================================
            this.ws.on("error", (err) => {
                console.log("❌ WebSocket Error:", err.message);
                reject(err);
            });

            // ================================
            // CLOSE HANDLER
            // ================================
            this.ws.on("close", () => {
                console.log("⚠️ Deriv connection closed");
                this.isAuthorized = false;
            });

        });
    }

    // ========================================
    // STEP 5: PROPOSAL + BUY FLOW (FIXED)
    // ========================================
    buyTrade(signal, config = {}) {

        return new Promise((resolve, reject) => {

            if (!this.ws || this.ws.readyState !== 1 || !this.isAuthorized) {
                return reject("WebSocket not ready or unauthorized");
            }

            const payload = {
                buy: 1,
                price: config.stake || 1,

                parameters: {
                    amount: config.stake || 1,
                    basis: "stake",

                    contract_type: signal.signal || signal,

                    currency: "USD",

                    duration: config.duration || 1,
                    duration_unit: config.durationUnit || "t",

                    symbol: config.symbol || "R_100"
                }
            };

            this.ws.send(JSON.stringify(payload));

            // ================================
            // RESPONSE HANDLER
            // ================================
            const handler = (msg) => {

                let data;

                try {
                    data = JSON.parse(msg);
                } catch (err) {
                    return;
                }

                if (data.buy) {
                    this.ws.removeListener("message", handler);

                    resolve({
                        contractId: data.buy.contract_id,
                        status: "EXECUTED",
                        raw: data.buy
                    });
                }

                if (data.error) {
                    this.ws.removeListener("message", handler);
                    reject(data.error.message);
                }
            };

            this.ws.on("message", handler);
        });
    }

    // ========================================
    // HEARTBEAT (KEEP ALIVE)
    // ========================================
    startHeartbeat() {

        setInterval(() => {

            if (this.ws && this.ws.readyState === 1 && this.isAuthorized) {

                this.ws.send(JSON.stringify({ ping: 1 }));

                console.log("📡 Deriv heartbeat");
            }

        }, 30000);
    }
}

module.exports = DerivBot;
