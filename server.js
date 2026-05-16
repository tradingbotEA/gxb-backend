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
   ACTIVE USER SESSIONS
========================= */
const userSessions = {};

/* =========================
   WEB DASHBOARD CLIENTS
========================= */
let clients = [];

wss.on("connection", (socket) => {
    console.log("📡 Dashboard connected");
    clients.push(socket);

    socket.on("close", () => {
        clients = clients.filter(c => c !== socket);
    });
});

/* =========================
   PUSH LIVE UPDATE (PER USER)
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
   VALIDATE UID (CRITICAL SECURITY)
========================= */
function validateUID(uid) {
    return uid && typeof uid === "string" && uid.length > 10;
}

/* =========================
   CREATE DERIV SESSION PER USER
========================= */
function connectDeriv(uid, token) {

    if (userSessions[uid]?.ws) {
        console.log("⚠️ Bot already running for:", uid);
        return;
    }

    const ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");

    userSessions[uid] = {
        ws,
        running: true,
        connected: false,
        trades: 0,
        profit: 0,
        wins: 0,
        losses: 0,
        lastUpdate: Date.now()
    };

    ws.on("open", () => {
        console.log("🔌 Connecting Deriv:", uid);

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
            console.log("✅ Authorized:", uid);
        }

        // TRADE UPDATE
        if (data.msg_type === "buy") {
            session.trades++;
        }

        session.lastUpdate = Date.now();
        pushUpdate(uid);
    });

    ws.on("close", () => {
        console.log("🔴 Disconnected:", uid);
        delete userSessions[uid];
        pushUpdate(uid);
    });

    ws.on("error", (err) => {
        console.log("❌ Deriv error:", err.message);
    });
}

/* =========================
   START BOT (SAFE)
========================= */
app.post("/api/start", (req, res) => {

    const { uid } = req.body;

    // VALIDATION
    if (!validateUID(uid)) {
        return res.status(400).json({
            success: false,
            error: "Missing or invalid UID"
        });
    }

    const token = process.env.DERIV_TOKEN;

    if (!token) {
        return res.status(500).json({
            success: false,
            error: "DERIV_TOKEN missing"
        });
    }

    // PREVENT DOUBLE START
    if (userSessions[uid]?.running) {
        return res.json({
            success: true,
            status: "already_running",
            uid
        });
    }

    console.log("🟢 START BOT:", uid);

    connectDeriv(uid, token);

    return res.json({
        success: true,
        status: "running",
        uid
    });
});

/* =========================
   STOP BOT (SAFE)
========================= */
app.post("/api/stop", (req, res) => {

    const { uid } = req.body;

    if (!validateUID(uid)) {
        return res.status(400).json({
            success: false,
            error: "Missing or invalid UID"
        });
    }

    const session = userSessions[uid];

    if (!session) {
        return res.json({
            success: true,
            status: "not_running",
            uid
        });
    }

    try {
        session.running = false;

        if (session.ws) {
            session.ws.close();
        }

        delete userSessions[uid];

        console.log("🔴 STOP BOT:", uid);

        pushUpdate(uid);

        return res.json({
            success: true,
            status: "stopped",
            uid
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* =========================
   USER STATUS
========================= */
app.get("/api/status/:uid", (req, res) => {

    const uid = req.params.uid;

    if (!validateUID(uid)) {
        return res.status(400).json({
            success: false,
            error: "Invalid UID"
        });
    }

    const session = userSessions[uid];

    if (!session) {
        return res.json({
            connected: false,
            running: false,
            trades: 0,
            profit: 0
        });
    }

    return res.json(session);
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
    res.send("🚀 Multi-User Deriv Bot Backend Running (PRO MODE)");
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});
