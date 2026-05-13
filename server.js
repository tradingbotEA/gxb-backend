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
