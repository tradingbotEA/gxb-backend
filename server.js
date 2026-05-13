const express = require("express");
const WebSocket = require("ws");
const cors = require("cors");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// =========================
// FIREBASE INIT
// =========================

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
});

const db = admin.firestore();

// =========================
// DERIV WS
// =========================

const DERIV_WS = "wss://ws.binaryws.com/websockets/v3?app_id=1089";
let ws;

// =========================
// MARKET DATA
// =========================

let marketPrices = [];

// =========================
// CONNECT DERIV
// =========================

function connectDeriv() {
    ws = new WebSocket(DERIV_WS);

    ws.on("open", () => {
        console.log("✅ Connected to Deriv");

        ws.send(JSON.stringify({
            authorize: process.env.DERIV_TOKEN
        }));

        ws.send(JSON.stringify({
            ticks: "R_100",
            subscribe: 1
        }));
    });

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        if (data.tick) {
            marketPrices.push(data.tick.quote);

            if (marketPrices.length > 120) {
                marketPrices.shift();
            }
        }
    });

    ws.on("close", () => {
        console.log("❌ Reconnecting...");
        setTimeout(connectDeriv, 5000);
    });
}

connectDeriv();

// =========================
// USER SYSTEM (FIRESTORE)
// =========================

async function getUser(userId) {
    const ref = db.collection("users").doc(userId);
    const doc = await ref.get();

    if (!doc.exists) {
        const newUser = {
            botRunning: false,
            lastTradeTime: 0,

            totalTrades: 0,
            wins: 0,
            losses: 0,
            balance: 0,

            trades: [],
            equity: [],

            lastSignal: null,
            lastConfidence: 0,
            pendingTrades: {}
        };

        await ref.set(newUser);
        return newUser;
    }

    return doc.data();
}

async function saveUser(userId, data) {
    await db.collection("users").doc(userId).set(data, { merge: true });
}

// =========================
// BOT START / STOP
// =========================

app.post("/start-bot", async (req, res) => {
    const { userId } = req.body;

    const user = await getUser(userId);
    user.botRunning = true;

    await saveUser(userId, user);

    res.json({ status: "started" });
});

app.post("/stop-bot", async (req, res) => {
    const { userId } = req.body;

    const user = await getUser(userId);
    user.botRunning = false;

    await saveUser(userId, user);

    res.json({ status: "stopped" });
});

// =========================
// TRADE HISTORY API
// =========================

app.get("/trades/:userId", async (req, res) => {
    const user = await getUser(req.params.userId);

    res.json({
        summary: {
            totalTrades: user.totalTrades,
            wins: user.wins,
            losses: user.losses,
            balance: user.balance
        },
        trades: user.trades.slice().reverse()
    });
});

// =========================
// EQUITY API
// =========================

app.get("/equity/:userId", async (req, res) => {
    const user = await getUser(req.params.userId);

    res.json({ equity: user.equity || [] });
});

// =========================
// SMC ENGINE
// =========================

async function smcEngine(userId) {
    const user = await getUser(userId);

    if (!user.botRunning) return;
    if (marketPrices.length < 30) return;

    const now = Date.now();

    if (now - user.lastTradeTime < 8000) return;

    const prices = marketPrices.slice(-30);

    const latest = prices.at(-1);
    const prev = prices.at(-2);

    if (!latest || !prev) return;

    let highs = [];
    let lows = [];

    for (let i = 1; i < prices.length - 1; i++) {
        if (prices[i] > prices[i - 1] && prices[i] > prices[i + 1]) highs.push(prices[i]);
        if (prices[i] < prices[i - 1] && prices[i] < prices[i + 1]) lows.push(prices[i]);
    }

    const lastHigh = highs.at(-1) || latest;
    const lastLow = lows.at(-1) || latest;

    const bosUp = latest > lastHigh;
    const bosDown = latest < lastLow;

    const momentum = latest - prev;

    let signal = null;
    let confidence = 80;

    if ((bosUp && momentum > 0)) signal = "CALL";
    if ((bosDown && momentum < 0)) signal = "PUT";

    if (!signal) return;

    const tradeId = Date.now().toString();

    const trade = {
        id: tradeId,
        time: Date.now(),
        signal,
        confidence,
        entry: latest,
        symbol: "R_100",
        status: "OPEN"
    };

    user.trades.push(trade);
    user.pendingTrades[tradeId] = trade;

    user.lastSignal = signal;
    user.lastConfidence = confidence;
    user.lastTradeTime = now;

    user.totalTrades++;

    // EXECUTE TRADE
    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
            buy: 1,
            parameters: {
                amount: 1,
                basis: "stake",
                contract_type: signal,
                currency: "USD",
                duration: 1,
                duration_unit: "t",
                symbol: "R_100"
            }
        }));
    }

    await saveUser(userId, user);
}

// =========================
// BOT LOOP
// =========================

setInterval(async () => {
    const usersSnapshot = await db.collection("users").get();

    usersSnapshot.forEach(doc => {
        smcEngine(doc.id);
    });

}, 4000);

// =========================
// SERVER START
// =========================

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

app.get("/firebase-test", async (req, res) => {
    try {
        const ref = db.collection("test").doc("connection");
        await ref.set({
            status: "working",
            time: Date.now()
        });

        const doc = await ref.get();

        res.json({
            ok: true,
            data: doc.data()
        });

    } catch (err) {
        res.json({
            ok: false,
            error: err.message
        });
    }
});
