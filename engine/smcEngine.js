function calculateSMC(prices) {
    if (prices.length < 30) return null;

    const latest = prices.at(-1);
    const prev = prices.at(-2);

    let highs = [];
    let lows = [];

    for (let i = 1; i < prices.length - 1; i++) {
        if (prices[i] > prices[i - 1] && prices[i] > prices[i + 1]) {
            highs.push(prices[i]);
        }
        if (prices[i] < prices[i - 1] && prices[i] < prices[i + 1]) {
            lows.push(prices[i]);
        }
    }

    const lastHigh = highs.at(-1) || latest;
    const lastLow = lows.at(-1) || latest;

    const bosUp = latest > lastHigh;
    const bosDown = latest < lastLow;

    const momentum = latest - prev;

    let signal = null;
    let confidence = 0;

    if (bosUp && momentum > 0) {
        signal = "CALL";
        confidence = 80;
    }

    if (bosDown && momentum < 0) {
        signal = "PUT";
        confidence = 80;
    }

    if (!signal) return null;

    return {
        signal,
        confidence,
        entry: latest
    };
}

module.exports = { calculateSMC };
