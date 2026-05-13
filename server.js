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
        console.log(msg.toString());
    });
}

connectDeriv();

app.post("/trade", (req, res) => {
    const { amount, type, symbol } = req.body;

    if (!ws || ws.readyState !== 1) {
        return res.json({ status: "error", message: "WebSocket not ready" });
    }

    ws.send(JSON.stringify({
        buy: 1,
        price: amount,
        parameters: {
            amount,
            basis: "stake",
            contract_type: type, // CALL or PUT
            currency: "USD",
            duration: 5,
            duration_unit: "t",
            symbol
        }
    }));

    res.json({
        status: "sent",
        trade: { amount, type, symbol }
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
