const express = require("express");
const router = express.Router();
const DerivBot = require("../services/derivBot");

router.post("/start", async (req, res) => {
    try {
        const { token } = req.body;

        const bot = new DerivBot(token);

        await bot.connect();
        const trade = await bot.buy();

        res.json({
            success: true,
            trade
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err
        });
    }
});

module.exports = router;
