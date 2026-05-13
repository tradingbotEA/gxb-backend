function executeTrade(ws, trade) {
    if (!ws || ws.readyState !== 1) return;

    ws.send(JSON.stringify({
        buy: 1,
        parameters: {
            amount: 1,
            basis: "stake",
            contract_type: trade.signal,
            currency: "USD",
            duration: 1,
            duration_unit: "t",
            symbol: "R_100"
        }
    }));
}

module.exports = { executeTrade };
