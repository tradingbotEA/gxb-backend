const WebSocket = require("ws");

class DerivBot {
    constructor(token) {
        this.token = token;
        this.ws = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");

            this.ws.on("open", () => {
                console.log("Connected to Deriv ✅");

                this.ws.send(JSON.stringify({
                    authorize: this.token
                }));
            });

            this.ws.on("message", (msg) => {
                const data = JSON.parse(msg);

                if (data.error) {
                    reject(data.error);
                }

                if (data.authorize) {
                    console.log("Authorized 🔐");
                    resolve();
                }
            });

            this.ws.on("error", reject);
        });
    }

    buy() {
        return new Promise((resolve) => {
            this.ws.send(JSON.stringify({
                buy: 1,
                price: 5,
                parameters: {
                    amount: 5,
                    basis: "stake",
                    contract_type: "CALL",
                    currency: "USD",
                    duration: 1,
                    duration_unit: "m",
                    symbol: "R_100"
                }
            }));

            this.ws.on("message", (msg) => {
                const data = JSON.parse(msg);

                if (data.buy) {
                    resolve(data);
                }
            });
        });
    }
}

module.exports = DerivBot;
