const express = require("express");
const WebSocket = require("ws");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

/* =========================================
   CONFIG
========================================= */

const PORT = process.env.PORT || 3000;

const DERIV_WS =
  "wss://ws.binaryws.com/websockets/v3?app_id=1089";

/* =========================================
   GLOBAL VARIABLES
========================================= */

let ws;

// Shared market data
let marketPrices = [];

// Multi-user store
const users = {};

// Risk settings
const MAX_DAILY_LOSS = 50;

/* =========================================
   USER INITIALIZER
========================================= */

function initializeUser(userId) {
  if (!users[userId]) {
    users[userId] = {
      botRunning: false,
      lastTradeTime: 0,
      dailyLoss: 0,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      balance: 0,
    };

    console.log(`✅ User initialized: ${userId}`);
  }
}

/* =========================================
   CONNECT TO DERIV
========================================= */

function connectDeriv() {
  ws = new WebSocket(DERIV_WS);

  ws.on("open", () => {
    console.log("✅ Connected to Deriv API");

    // AUTHORIZE
    ws.send(
      JSON.stringify({
        authorize: process.env.DERIV_TOKEN,
      })
    );

    // LIVE MARKET DATA
    ws.send(
      JSON.stringify({
        ticks: "R_100",
        subscribe: 1,
      })
    );
  });

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    // DEBUG LOG
    console.log("📩 DERIV:", data);

    // LIVE PRICE STREAM
    if (data.tick) {
      const price = data.tick.quote;

      marketPrices.push(price);

      // KEEP ONLY LAST 100 PRICES
      if (marketPrices.length > 100) {
        marketPrices.shift();
      }

      console.log("📈 PRICE:", price);
    }

    // TRADE RESULTS
    if (data.proposal_open_contract) {
      console.log("📊 CONTRACT UPDATE:", data.proposal_open_contract);
    }
  });

  ws.on("close", () => {
    console.log("❌ WebSocket disconnected");

    // AUTO RECONNECT
    setTimeout(connectDeriv, 5000);
  });

  ws.on("error", (err) => {
    console.log("❌ WebSocket Error:", err.message);
  });
}

connectDeriv();

/* =========================================
   BASIC ROUTES
========================================= */

app.get("/", (req, res) => {
  res.send("🚀 GIBSONFX Backend Running");
});

app.get("/status", (req, res) => {
  res.json({
    server: "online",
    websocket: ws ? ws.readyState : 0,
    users: Object.keys(users).length,
    marketPrices: marketPrices.length,
  });
});

/* =========================================
   START BOT
========================================= */

app.post("/start-bot", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.json({
      status: "error",
      message: "Missing userId",
    });
  }

  initializeUser(userId);

  users[userId].botRunning = true;

  res.json({
    status: "running",
    userId,
  });
});

/* =========================================
   STOP BOT
========================================= */

app.post("/stop-bot", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.json({
      status: "error",
      message: "Missing userId",
    });
  }

  initializeUser(userId);

  users[userId].botRunning = false;

  res.json({
    status: "stopped",
    userId,
  });
});

/* =========================================
   MANUAL TRADE ENDPOINT
========================================= */

app.post("/trade", (req, res) => {
  const { userId, amount, type, symbol } = req.body;

  if (!userId) {
    return res.json({
      status: "error",
      message: "Missing userId",
    });
  }

  initializeUser(userId);

  const user = users[userId];

  // BOT OFF
  if (!user.botRunning) {
    return res.json({
      status: "blocked",
      message: "Bot is OFF",
    });
  }

  // WS CHECK
  if (!ws || ws.readyState !== 1) {
    return res.json({
      status: "error",
      message: "WebSocket not connected",
    });
  }

  ws.send(
    JSON.stringify({
      buy: 1,
      price: amount,
      parameters: {
        amount,
        basis: "stake",
        contract_type: type,
        currency: "USD",
        duration: 5,
        duration_unit: "t",
        symbol,
      },
    })
  );

  user.lastTradeTime = Date.now();

  user.totalTrades++;

  res.json({
    status: "sent",
    trade: {
      amount,
      type,
      symbol,
    },
  });
});

/* =========================================
   SIMPLE BOT STRATEGY
========================================= */

function simpleBot(userId) {
  initializeUser(userId);

  const user = users[userId];

  // BOT OFF
  if (!user.botRunning) return;

  // NEED ENOUGH MARKET DATA
  if (marketPrices.length < 2) return;

  // DAILY LOSS LIMIT
  if (user.dailyLoss >= MAX_DAILY_LOSS) {
    console.log(`🛑 Daily loss limit hit for ${userId}`);

    user.botRunning = false;

    return;
  }

  // COOLDOWN SYSTEM
  const now = Date.now();

  if (now - user.lastTradeTime < 10000) {
    console.log(`⏳ Cooldown active for ${userId}`);

    return;
  }

  const last = marketPrices[marketPrices.length - 1];

  const prev = marketPrices[marketPrices.length - 2];

  let signal;

  // SIMPLE TREND STRATEGY
  if (last > prev) {
    signal = "CALL";
  } else {
    signal = "PUT";
  }

  console.log(`📊 SIGNAL for ${userId}: ${signal}`);

  // EXECUTE TRADE
  ws.send(
    JSON.stringify({
      buy: 1,
      price: 1,
      parameters: {
        amount: 1,
        basis: "stake",
        contract_type: signal,
        currency: "USD",
        duration: 1,
        duration_unit: "t",
        symbol: "R_100",
      },
    })
  );

  user.lastTradeTime = Date.now();

  user.totalTrades++;
}

/* =========================================
   AUTO BOT LOOP
========================================= */

setInterval(() => {
  Object.keys(users).forEach((userId) => {
    simpleBot(userId);
  });
}, 5000);

/* =========================================
   USER INFO
========================================= */

app.get("/user/:userId", (req, res) => {
  const { userId } = req.params;

  initializeUser(userId);

  res.json(users[userId]);
});

/* =========================================
   SERVER START
========================================= */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
