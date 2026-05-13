const WebSocket = require("ws");

class DerivBot {
    constructor(token) {
        this.token = token;
        this.ws = null;

        // C — KEEP CONNECTION ALIVE (heartbeat)
        this.startHeartbeat();
    }

    connect() {
        return new Promise((resolve, reject) => {

            this.ws = new WebSocket(
                "wss://ws.derivws.com/websockets/v3?app_id=1089"
            );

            // A — CONNECTION OPEN
            this.ws.on("open", () => {
                console.log("🔌 Connected to Deriv WebSocket");

                // AUTHORIZE
                this.ws.send(JSON.stringify({
                    authorize: this.token
                }));
            });

            // B — MESSAGE HANDLER (AUTH + TRADES)
            this.ws.on("message", (msg) => {
                const data = JSON.parse(msg);

                // ❌ ERROR HANDLING
                if (data.error) {
                    console.log("❌ Deriv Error:", data.error.message);
                    reject(data.error.message);
                    return;
                }

                // 🔐 AUTH SUCCESS
                if (data.authorize) {
                    console.log("✅ Authorized successfully");
                    console.log("Login ID:", data.authorize.loginid);

                    resolve(); // bot ready
                }

                // 💰 TRADE CONFIRMATION
                if (data.buy) {
                    console.log("💰 Trade executed successfully");
                    console.log(data.buy);
                }
            });

            this.ws.on("error", (err) => {
                console.log("WebSocket Error:", err.message);
                reject(err);
            });

            this.ws.on("close", () => {
                console.log("⚠️ Connection closed");
            });
        });
    }

    // TRADE FUNCTION
    buy() {
        return new Promise((resolve, reject) => {

            if (!this.ws || this.ws.readyState !== 1) {
                return reject("WebSocket not connected");
            }

            this.ws.send(JSON.stringify({
                buy: 1,
                price: 5,
                parameters: {
                    amount: 1,
                    basis: "stake",
                    contract_type: "CALL",
                    currency: "USD",
                    duration: 1,
                    duration_unit: "m",
                    symbol: "R_100"
                }
            }));

            // listen once for response
            const handler = (msg) => {
                const data = JSON.parse(msg);

                if (data.buy) {
                    this.ws.removeListener("message", handler);
                    resolve(data.buy);
                }

                if (data.error) {
                    this.ws.removeListener("message", handler);
                    reject(data.error.message);
                }
            };

            this.ws.on("message", handler);
        });
    }

    // C — KEEP CONNECTION ALIVE (PING SYSTEM)
    startHeartbeat() {
        setInterval(() => {
            if (this.ws && this.ws.readyState === 1) {
                this.ws.send(JSON.stringify({ ping: 1 }));
                console.log("📡 Ping sent to Deriv");
            }
        }, 30000);
    }
}

module.exports = DerivBot;
