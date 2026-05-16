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

/* =========================
   USER SESSIONS (STEP 3 CORE)
========================= */
const userSessions = {};

/* =========================
   DERIV TOKEN (TEMP GLOBAL - STEP 4 WILL MOVE TO FIREBASE)
========================= */
if (!process.env.DERIV_TOKEN) {
    console.log("⚠️ DERIV_TOKEN is missing");
}

/* =========================
   WEBSOCKET CLIENTS (DASHBOARD UI)
========================= */
let clients = [];

wss.on("connection", (socket) => {
    console.log("📡 Client connected");
    clients.push(socket);

    socket.on("close", () => {
        clients = clients.filter(c => c !== socket);
    });
});

/* =========================
   PUSH GLOBAL UI UPDATE
========================= */
function pushUpdate(uid = null) {

    const payload = JSON.stringify({
        type: "update",
        uid,
        session: uid ? userSessions[uid] : null
    });

    clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(payload);
        }
    });
}

/* =========================
   DERIV CONNECTION PER USER
========================= */
function connectDeriv(uid, token) {

    const ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");

    userSessions[uid] = {
        ws,
        running: true,
        trades: 0,
        profit: 0,
        wins: 0,
        losses: 0,
        connected: false
    };

    ws.on("open", () => {
        ws.send(JSON.stringify({
            authorize: token
        }));
    });

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        const session = userSessions[uid];
        if (!session) return;

        // AUTH SUCCESS
        if (data.msg_type === "authorize") {
            session.connected = true;
            console.log("✔ Deriv connected:", uid);
        }

        // LIVE TRADE UPDATE (placeholder for Step 4)
        if (data.msg_type === "buy" || data.msg_type === "sell") {
            session.trades++;
        }

        pushUpdate(uid);
    });

    ws.on("close", () => {
        delete userSessions[uid];
    });

    ws.on("error", (err) => {
        console.log("Deriv error:", err.message);
    });
}

/* =========================
   START BOT (PER USER)
========================= */
app.post("/api/start", (req, res) => {

    const { uid } = req.body;

    if (!uid) {
        return res.status(400).json({ error: "Missing UID" });
    }

    const token = process.env.DERIV_TOKEN;

    connectDeriv(uid, token);

    console.log("🟢 BOT STARTED FOR:", uid);

    res.json({
        success: true,
        status: "running",
        uid
    });
});

/* =========================
   STOP BOT (PER USER)
========================= */
app.post("/api/stop", (req, res) => {

    const { uid } = req.body;

    const session = userSessions[uid];

    if (session) {
        session.ws.close();
        delete userSessions[uid];
    }

    console.log("🔴 BOT STOPPED FOR:", uid);

    res.json({
        success: true,
        status: "stopped",
        uid
    });
});

/* =========================
   USER STATUS API
========================= */
app.get("/api/status/:uid", (req, res) => {

    const uid = req.params.uid;
    const session = userSessions[uid];

    if (!session) {
        return res.json({
            connected: false,
            running: false,
            trades: 0,
            profit: 0
        });
    }

    res.json(session);
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
    res.send("Backend Running ✔ (Step 3 Multi-User Mode)");
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});
