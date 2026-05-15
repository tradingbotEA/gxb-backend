require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const { WebSocketServer } = require("ws");

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   SERVER + WEBSOCKET SETUP
========================= */
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let clients = [];

/* =========================
   GLOBAL BOT STATE
========================= */
let prices = [];

let risk = {
    trades: 0,
    profit: 0,
    wins: 0,
    losses: 0,
    stopped: false
};

/* =========================
   DASHBOARD CONNECTIONS
========================= */
wss.on("connection", (socket) => {
    console.log("📡 Dashboard connected");

    clients.push(socket);

    socket.on("close", () => {
        clients = clients.filter(c => c !== socket);
    });
});

/* =========================
   SAFE LIVE PUSH FUNCTION
========================= */
function pushUpdate() {
    const payload = {
        type: "update",
        trades: Number(risk.trades || 0),
        profit: Number(risk.profit || 0),
        wins: Number(risk.wins || 0),
        losses: Number(risk.losses || 0),
        status: risk.stopped ? "stopped" : "running"
    };

    const data = JSON.stringify(payload);

    console.log("📡 PUSH:", payload);

    clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(data);
        }
    });
}

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
    res.send("Backend Running ✔");
});

/* =========================
   STATUS API
========================= */
app.get("/api/status", (req, res) => {
    res.json({
        bot: risk.stopped ? "stopped" : "running",
        trades: risk.trades || 0,
        profit: risk.profit || 0,
        wins: risk.wins || 0,
        losses: risk.losses || 0
    });
});

/* =========================
   DERIV TEST CONNECTION
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
            res.status(500).json({ error: err.message });
        }
    });
});

/* =========================
   RISK MANAGEMENT
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
   PRICE MEMORY
========================= */
function updatePrices(price) {
    prices.push(price);

    if (prices.length > 50) {
        prices.shift();
    }
}

/* =========================
   SMART STRATEGY v2
========================= */
function smartSignal() {
    if (prices.length < 30) return null;

    const last10 = prices.slice(-10);
    const last20 = prices.slice(-20);
    const last30 = prices.slice(-30);

    const avg10 = last10.reduce((a, b) => a + b, 0) / last10.length;
    const avg20 = last20.reduce((a, b) => a + b, 0) / last20.length;
    const avg30 = last30.reduce((a, b) => a + b, 0) / last30.length;

    const trend = avg10 - avg30;
    const momentum = avg10 - avg20;

    const volatility = Math.max(...last10) - Math.min(...last10);

    if (volatility < 0.3) return null;
    if (Math.abs(trend) < 0.2) return null;

    if (trend > 0 && momentum > 0) return "CALL";
    if (trend < 0 && momentum < 0) return "PUT";

    return null;
}

/* =========================
   PLACE TRADE
========================= */
function placeTrade(ws, signal) {
    ws.send(JSON.stringify({
        buy: 1,
        price: 1,
        parameters: {
            amount: 1,
            basis: "stake",
            contract_type: signal,
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

        /* PRICE FEED (safe optional) */
        if (data.tick && data.tick.quote) {
            updatePrices(data.tick.quote);
        }

        /* AUTH */
        if (data.msg_type === "authorize") {

            if (!canTrade()) {
                ws.close();
                return;
            }

            const signal = smartSignal();

            if (!signal) {
                ws.close();
                return;
            }

            risk.trades++;
            pushUpdate();

            placeTrade(ws, signal);
        }

        /* PROFIT RESULT */
        if (data.msg_type === "proposal_open_contract") {

            const contract = data.proposal_open_contract;

            if (contract && contract.is_sold) {

                const profit = Number(contract.profit || 0);

                risk.profit += profit;

                if (profit > 0) risk.wins++;
                else risk.losses++;

                pushUpdate();
            }
        }

        /* RESPONSE */
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
            res.status(500).json({ error: err.message });
        }
    });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});
