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
   SAFE ENV CHECK
========================= */
if (!process.env.DERIV_TOKEN) {
    console.log("⚠️ WARNING: DERIV_TOKEN is missing");
}

/* =========================
   HTTP + WS SERVER
========================= */
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let clients = [];

/* =========================
   BOT STATE (SAFE DEFAULTS)
========================= */
let risk = {
    trades: 0,
    profit: 0,
    wins: 0,
    losses: 0,
    stopped: false
};

/* =========================
   WEBSOCKET CONNECTION
========================= */
wss.on("connection", (socket) => {
    console.log("📡 Client connected");

    clients.push(socket);

    socket.on("close", () => {
        clients = clients.filter(c => c !== socket);
    });
});

/* =========================
   SAFE PUSH FUNCTION
========================= */
function pushUpdate() {
    const payload = {
        type: "update",
        trades: risk.trades || 0,
        profit: risk.profit || 0,
        wins: risk.wins || 0,
        losses: risk.losses || 0,
        status: risk.stopped ? "stopped" : "running"
    };

    const data = JSON.stringify(payload);

    clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(data);
        }
    });
}

/* =========================
   ROUTES
========================= */

// Health check
app.get("/", (req, res) => {
    res.send("Backend Running ✔");
});

// Status
app.get("/api/status", (req, res) => {
    res.json(risk);
});

/* =========================
   SAFE DERIV TEST (NO CRASH)
========================= */
app.get("/api/test-deriv", (req, res) => {

    try {
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

    } catch (err) {
        res.status(500).json({ error: "WebSocket failed", details: err.message });
    }
});

/* =========================
   SIMPLE TRADE SIMULATION (SAFE)
   (prevents crash while testing)
========================= */
app.get("/api/trade", (req, res) => {

    try {
        risk.trades += 1;

        // fake profit for stability testing
        const profit = Math.random() > 0.5 ? 1 : -1;

        risk.profit += profit;

        if (profit > 0) risk.wins++;
        else risk.losses++;

        pushUpdate();

        res.json({
            status: "TRADE SIMULATED (SAFE MODE)",
            profit
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* =========================
   START SERVER (SAFE)
========================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});
