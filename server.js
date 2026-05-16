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
   SERVER SETUP
========================= */
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let clients = [];

/* =========================
   SAFE DERIV TOKEN CHECK
========================= */
if (!process.env.DERIV_TOKEN) {
    console.log("⚠️ DERIV_TOKEN is missing");
}

/* =========================
   BOT STATE
========================= */
let risk = {
    trades: 0,
    profit: 0,
    wins: 0,
    losses: 0,
    stopped: true
};

/* =========================
   WEBSOCKET CLIENTS
========================= */
wss.on("connection", (socket) => {
    console.log("📡 Client connected");
    clients.push(socket);

    socket.on("close", () => {
        clients = clients.filter(c => c !== socket);
    });
});

/* =========================
   PUSH LIVE UPDATE
========================= */
function pushUpdate() {
    const payload = JSON.stringify({
        type: "update",
        trades: risk.trades,
        profit: risk.profit,
        wins: risk.wins,
        losses: risk.losses,
        status: risk.stopped ? "stopped" : "running"
    });

    clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(payload);
        }
    });
}

/* =========================
   BACKGROUND BOT LOOP
========================= */
setInterval(() => {
    if (risk.stopped) return;

    risk.trades++;

    const profit = Math.random() > 0.5 ? 1 : -1;

    risk.profit += profit;

    if (profit > 0) risk.wins++;
    else risk.losses++;

    console.log("📊 Trade executed");

    pushUpdate();

}, 3000);

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
   START BOT
========================= */
app.post("/api/start", (req, res) => {
    try {
        risk.stopped = false;

        console.log("🟢 BOT STARTED");

        pushUpdate();

        res.json({
            success: true,
            status: "running"
        });

    } catch (err) {
        console.log("START ERROR:", err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* =========================
   STOP BOT
========================= */
app.post("/api/stop", (req, res) => {
    try {
        risk.stopped = true;

        console.log("🔴 BOT STOPPED");

        pushUpdate();

        res.json({
            success: true,
            status: "stopped"
        });

    } catch (err) {
        console.log("STOP ERROR:", err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* =========================
   DERIV TEST (SAFE)
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
        res.status(500).json({ error: err.message });
    }
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});
