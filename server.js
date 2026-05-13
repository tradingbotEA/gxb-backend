const express = require("express");
const WebSocket = require("ws");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const DERIV_WS = "wss://ws.binaryws.com/websockets/v3?app_id=1089";

let ws;

function connectDeriv() {
    ws = new WebSocket(DERIV_WS);

    ws.on("open", () => {
        console.log("Connected");

        ws.send(JSON.stringify({
            authorize: process.env.DERIV_TOKEN
        }));
    });

    ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data.tick) {
        const price = data.tick.quote;

        priceHistory.push(price);

        if (priceHistory.length > 50) {
            priceHistory.shift();
        }

        console.log("Price:", price);
    }
});

connectDeriv();

app.post("/trade", (req, res) => {
    const { amount, type, symbol } = req.body;

    // 🔒 STOP BOT CHECK (IMPORTANT)
    if (!botRunning) {
        return res.json({
            status: "stopped",
            message: "Bot is OFF. No trades allowed."
        });
    }

    if (!ws || ws.readyState !== 1) {
        return res.json({
            status: "error",
            message: "WebSocket not connected"
        });
    }

    ws.send(JSON.stringify({
        buy: 1,
        price: amount,
        parameters: {
            amount,
            basis: "stake",
            contract_type: type,
            currency: "USD",
            duration: 5,
            duration_unit: "t",
            symbol: symbol
        }
    }));

    res.json({
        status: "sent",
        message: "Trade executed"
    });
});
app.get("/", (req, res) => {
    res.send("GIBSONFX backend running");
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server running");
});

app.get("/status", (req, res) => {
    res.json({
        server: "online",
        websocket: ws ? ws.readyState : "not connected"
    });
});

ws.on("open", () => {
    console.log("Connected to Deriv API");

    ws.send(JSON.stringify({
        authorize: process.env.DERIV_TOKEN
    }));

    // 🔥 LIVE MARKET STREAM
    ws.send(JSON.stringify({
        ticks: "R_100",
        subscribe: 1
    }));
});
let botRunning = true;

app.post("/stop-bot", (req, res) => {
    botRunning = false;

    res.json({
        status: "stopped",
        message: "Bot has been disabled"
    });
});

let priceHistory = [];

    function simpleBot() {
    if (priceHistory.length < 2) return;

    const last = priceHistory[priceHistory.length - 1];
    const prev = priceHistory[priceHistory.length - 2];

    if (!botRunning) return;

    let signal;

    if (last > prev) {
        signal = "CALL";
    } else {
        signal = "PUT";
    }
        const now = Date.now();

// 10 seconds cooldown
if (now - lastTradeTime < 10000) {
    console.log("Cooldown active - skipping trade");
    return;
}

    console.log("Signal:", signal);

    ws.send(JSON.stringify({
        buy: 1,
        price: 1,
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

    setInterval(() => {
    simpleBot();
}, 5000);
