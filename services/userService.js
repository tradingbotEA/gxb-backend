async function initUser(db, userId) {
    const ref = db.collection("users").doc(userId);
    const doc = await ref.get();

    if (!doc.exists) {
        const user = {
            botRunning: false,
            lastTradeTime: 0,
            trades: [],
            totalTrades: 0,
            wins: 0,
            losses: 0,
            balance: 0
        };

        await ref.set(user);
        return user;
    }

    return doc.data();
}

async function saveUser(db, userId, data) {
    await db.collection("users").doc(userId).set(data, { merge: true });
}

module.exports = { initUser, saveUser };
