require("dotenv").config();

const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   GLOBAL BOT STATE
========================= */
let risk = {
    trades: 0,
    profit: 0,
    wins: 0,
    losses: 0,
    stopped: false
};

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
    res.send("Backend Running ✔");
});

/* =========================
   STATUS API (FRONTEND)
========================= */
app.get("/api/status", (req, res) => {
    res.json({
        bot: risk.stopped ? "stopped" : "running",
        balance: risk.profit,
        trades: risk.trades,
        wins: risk.wins,
        losses: risk.losses
    });
});

/* =========================
   DERIV CONNECTION TEST
========================= */
app.get("/api/test-deriv", (req, res) => {
    const ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");

    let done = false;

    ws.on("open", () => {
        ws.send(JSON.stringify({
            authorize: process.env.DERIV_TOKEN
        }));
    });

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        if (!done) {
            done = true;
            res.json(data);
            ws.close();
        }
    });

    ws.on("error", (err) => {
        if (!done) {
            done = true;
            res.status(500).json({
                error: err.message
            });
        }
    });
});

/* =========================
   RISK CONTROL
========================= */
function canTrade() {
    if (risk.stopped) return false;

    if (risk.trades >= 20) {
        risk.stopped = true;
        return false;
    }

    if (risk.profit <= -10) {
        risk.stopped = true;
        return false;
    }

    return true;
}

/* =========================
   PLACE TRADE FUNCTION
========================= */
function placeTrade(ws) {
    ws.send(JSON.stringify({
        buy: 1,
        price: 1,
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
}

/* =========================
   MAIN TRADE ENDPOINT
========================= */
app.get("/api/trade", (req, res) => {
    const ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");

    let responded = false;

    ws.on("open", () => {
        ws.send(JSON.stringify({
            authorize: process.env.DERIV_TOKEN
        }));
    });

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        /* AUTH SUCCESS */
        if (data.msg_type === "authorize") {

            if (!canTrade()) {
                ws.close();
                return;
            }

            risk.trades++;
            placeTrade(ws);
        }

        /* PROFIT / LOSS TRACKING */
        if (data.msg_type === "proposal_open_contract") {

            const contract = data.proposal_open_contract;

            if (contract && contract.is_sold) {

                const profit = contract.profit || 0;

                risk.profit += profit;

                if (profit > 0) {
                    risk.wins++;
                } else {
                    risk.losses++;
                }

                console.log("💰 Profit:", profit);
                console.log("📊 Total Profit:", risk.profit);
            }
        }

        /* TRADE EXECUTED */
        if (data.msg_type === "buy" && !responded) {
            responded = true;

            res.json({
                status: "TRADE EXECUTED",
                trade: data
            });

            ws.close();
        }
    });

    ws.on("error", (err) => {
        if (!responded) {
            responded = true;
            res.status(500).json({
                error: err.message
            });
        }
    });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});
