// ======================================
// INSTITUTIONAL SMC ENGINE (STEP 5)
// Multi-layer confluence model
// ======================================

function getSwingPoints(prices, len = 3) {
    let highs = [];
    let lows = [];

    for (let i = len; i < prices.length - len; i++) {

        let isHigh = true;
        let isLow = true;

        for (let j = 1; j <= len; j++) {
            if (prices[i] <= prices[i - j] || prices[i] <= prices[i + j]) {
                isHigh = false;
            }
            if (prices[i] >= prices[i - j] || prices[i] >= prices[i + j]) {
                isLow = false;
            }
        }

        if (isHigh) highs.push(prices[i]);
        if (isLow) lows.push(prices[i]);
    }

    return { highs, lows };
}

// =========================
// STRUCTURE (BOS + CHoCH)
// =========================
function detectStructure(prices) {

    const latest = prices.at(-1);
    const prev = prices.at(-2);

    const { highs, lows } = getSwingPoints(prices, 3);

    const lastHigh = highs.at(-1) || latest;
    const lastLow = lows.at(-1) || latest;

    const bosUp = latest > lastHigh;
    const bosDown = latest < lastLow;

    const chochBull = bosUp && prev < latest;
    const chochBear = bosDown && prev > latest;

    return {
        bosUp,
        bosDown,
        chochBull,
        chochBear
    };
}

// =========================
// LIQUIDITY ENGINE
// =========================
function detectLiquidity(prices) {

    const last = prices.at(-1);

    const recentHigh = Math.max(...prices.slice(-10));
    const recentLow = Math.min(...prices.slice(-10));

    return {
        buySideLiquidity: last > recentHigh,
        sellSideLiquidity: last < recentLow
    };
}

// =========================
// FAIR VALUE GAP (FVG)
// =========================
function detectFVG(prices) {

    if (prices.length < 3) {
        return { bull: false, bear: false };
    }

    const a = prices.at(-3);
    const b = prices.at(-2);
    const c = prices.at(-1);

    return {
        bull: a > c,
        bear: a < c
    };
}

// =========================
// MAIN SMC ENGINE
// =========================
function calculateSMC(prices) {

    if (!prices || prices.length < 30) return null;

    const latest = prices.at(-1);
    const prev = prices.at(-2);

    const structure = detectStructure(prices);
    const liquidity = detectLiquidity(prices);
    const fvg = detectFVG(prices);

    let signal = null;
    let confidence = 0;

    // =========================
    // BUY SETUP (CONFLUENCE)
    // =========================
    if (
        structure.bosUp &&
        structure.chochBull &&
        liquidity.buySideLiquidity &&
        fvg.bull
    ) {
        signal = "CALL";
        confidence = 85;
    }

    // =========================
    // SELL SETUP (CONFLUENCE)
    // =========================
    if (
        structure.bosDown &&
        structure.chochBear &&
        liquidity.sellSideLiquidity &&
        fvg.bear
    ) {
        signal = "PUT";
        confidence = 85;
    }

    if (!signal) return null;

    return {
        signal,
        confidence,
        entry: latest,
        structure,
        liquidity,
        fvg
    };
}

module.exports = { calculateSMC };
