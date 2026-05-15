require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// HEALTH CHECK
app.get("/", (req, res) => {
    res.send("Backend Running ✔");
});

// ROUTES (ONLY IF FILE EXISTS)
try {
    const botRoutes = require("./routes/bot");
    app.use("/api/bot", botRoutes);
} catch (err) {
    console.log("⚠️ Bot routes not loaded:", err.message);
}

// START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});

app.get("/api/status", (req, res) => {
    res.json({
        bot: "running",
        balance: 0,
        trades: 0
    });
});

const WebSocket = require("ws");

app.get("/api/test-deriv", (req, res) => {
    const ws = new WebSocket("wss://ws.binaryws.com/websockets/v3");

    ws.onopen = () => {
        console.log("✅ Connected to Deriv");

        ws.send(JSON.stringify({
            authorize: process.env.DERIV_TOKEN
        }));
    };

    ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        console.log("DERIV RESPONSE:", data);

        res.json(data);
        ws.close();
    };

    ws.onerror = (err) => {
        console.log("❌ WS ERROR:", err);
        res.status(500).json({ error: "Connection failed" });
    };
});
