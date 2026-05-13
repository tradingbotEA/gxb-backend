const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const admin = require("firebase-admin");

const { startBotWorker } = require("./workers/botWorker");

const memory = {
    users: {},              // user state
    pendingContracts: {},   // open trades waiting for result
    marketPrices: [],      // price cache
    cooldowns: {},         // trade cooldown tracking
};

const app = express();
app.use(cors());
app.use(express.json());

const DERIV_WS = "wss://ws.binaryws.com/websockets/v3?app_id=1089";

let ws;
let marketPrices = [];
const users = {};

// FIREBASE INIT (env-based)
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASEPROJECTID,
        clientEmail: process.env.FIREBASECLIENTEMAIL,
        privateKey: process.env.FIREBASEPRIVATEKEY.replace(/\\n/g, "\n")
    })
});

const db = admin.firestore();

// CONNECT DERIV
function connectDeriv() {
    ws = new WebSocket(DERIV_WS);

    ws.on("open", () => {
        console.log("Connected to Deriv");

        ws.send(JSON.stringify({
            ticks: "R_100",
            subscribe: 1
        }));

        // START ENGINE ONLY HERE
        startBotWorker({ ws, db, users, marketPrices });
    });

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        if (data.tick) {
            marketPrices.push(data.tick.quote);

            if (marketPrices.length > 100) {
                marketPrices.shift();
            }
        }
    });

    ws.on("close", () => {
        console.log("Reconnecting...");
        setTimeout(connectDeriv, 5000);
    });
}

connectDeriv();

// BASIC ROUTE
app.get("/", (req, res) => {
    res.send("Backend Running");
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server running");
});
