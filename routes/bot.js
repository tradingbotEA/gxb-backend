const express = require("express");
const router = express.Router();
const DerivBot = require("../services/derivBot");

router.post("/start", async (req, res) => {
    try {
        const token = process.env.DERIV_TOKEN;

        if (!token) {
            return res.status(500).json({
                success: false,
                error: "DERIV_TOKEN missing in environment variables"
            });
        }

        const bot = new DerivBot(token);

        await bot.connect();
        const trade = await bot.buy();

        res.json({
            success: true,
            message: "Trade executed successfully",
            trade
        });

    } catch (err) {
        console.error("Bot Error:", err);

        res.status(500).json({
            success: false,
            error: err.message || err.toString()
        });
    }
});

module.exports = router;
