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

app.get("/", (req, res) => {
    res.send("GIBSONFX backend running");
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server running");
});
