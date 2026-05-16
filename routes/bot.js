// ========================================
// INSTITUTIONAL BOT ROUTES (STEP 5)
// Multi-user safe controller layer
// ========================================

const express = require("express");
const router = express.Router();

// ================================
// START BOT (GLOBAL OR USER MODE)
// ================================
router.post("/start", async (req, res) => {

    try {

        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: "userId is required"
            });
        }

        // ================================
        // ENABLE USER BOT IN DATABASE
        // ================================
        const userRef = db.collection("users").doc(userId);

        await userRef.set({
            botRunning: true,
            lastStartedAt: Date.now()
        }, { merge: true });

        console.log("🟢 BOT STARTED FOR USER:", userId);

        return res.json({
            success: true,
            status: "running",
            userId
        });

    } catch (err) {

        console.log("❌ START BOT ERROR:", err);

        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ================================
// STOP BOT
// ================================
router.post("/stop", async (req, res) => {

    try {

        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: "userId is required"
            });
        }

        const userRef = db.collection("users").doc(userId);

        await userRef.set({
            botRunning: false,
            lastStoppedAt: Date.now()
        }, { merge: true });

        console.log("🔴 BOT STOPPED FOR USER:", userId);

        return res.json({
            success: true,
            status: "stopped",
            userId
        });

    } catch (err) {

        console.log("❌ STOP BOT ERROR:", err);

        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ================================
// GET BOT STATUS (PER USER)
// ================================
router.get("/status/:userId", async (req, res) => {

    try {

        const { userId } = req.params;

        const userRef = db.collection("users").doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        const user = userSnap.data();

        return res.json({
            success: true,
            botRunning: user.botRunning || false,
            lastTradeTime: user.lastTradeTime || 0,
            totalTrades: user.totalTrades || 0,
            lastSignal: user.lastSignal || null,
            lastConfidence: user.lastConfidence || 0
        });

    } catch (err) {

        console.log("❌ STATUS ERROR:", err);

        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

module.exports = router;
