require("dotenv").config();

const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const admin = require("firebase-admin");

const { startBotWorker } = require("./workers/botWorker");

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- MEMORY ----------------
const memory = {
    users: {},
    pendingContracts: {},
    marketPrices: [],
    cooldowns: {}
};

// ---------------- FIREBASE ----------------
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASEPROJECTID,
        clientEmail: process.env.FIREBASECLIENTEMAIL,
        privateKey: process.env.FIREBASEPRIVATEKEY.replace(/\\n/g, "\n")
    })
});

const db = admin.firestore();

// ---------------- DERIV WS ----------------
const DERIV_WS = "wss://ws.binaryws.com/websockets/v3?app_id=1089";

let ws;

function connectDeriv() {
    ws = new WebSocket(DERIV_WS);

    ws.on("open", () => {
        console.log("🔌 Connected to Deriv");

        ws.send(JSON.stringify({
            ticks: "R_100",
            subscribe: 1
        }));

        // START BOT ENGINE
        startBotWorker({
            ws,
            db,
            memory
        });
    });

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        if (data.tick) {
            memory.marketPrices.push(data.tick.quote);

            if (memory.marketPrices.length > 100) {
                memory.marketPrices.shift();
            }
        }
    });

    ws.on("close", () => {
        console.log("⚠️ Reconnecting to Deriv...");
        setTimeout(connectDeriv, 5000);
    });

    ws.on("error", (err) => {
        console.log("WebSocket error:", err.message);
    });
}

connectDeriv();

// ---------------- ROUTES ----------------
const botRoutes = require("./routes/bot");
app.use("/api/bot", botRoutes);

// ---------------- HEALTH CHECK ----------------
app.get("/", (req, res) => {
    res.send("Backend Running ✔");
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});
