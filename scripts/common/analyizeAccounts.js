module.exports = function (loanEvents, untilBlockNumber) {
    const toBN = web3.utils.toBN;
    const accounts = {};
    loanEvents.forEach(e => {
        if (untilBlockNumber && e.blockNumber > untilBlockNumber) {
            return;
        }
        const owner = e.args.owner;
        const recipient = e.args.recipient;
        [owner, recipient].forEach(i => {
            if (!(i in accounts)) {
                accounts[i] = {
                    lDebt: toBN(0),
                    lRecipients: {},
                    sInternalAmount: toBN(0)
                };
            }
        });
        const ownerAccount = accounts[owner];
        const recipientAccount = accounts[recipient];
        if (!(recipient in ownerAccount.lRecipients)) {
            ownerAccount.lRecipients[recipient] = toBN(0);
        }
        const redeemableAmount = toBN(e.args.redeemableAmount);
        const sInternalAmount = toBN(e.args.internalSavingsAmount);
        ownerAccount.lRecipients[recipient] = e.args.isDistribution ?
            ownerAccount.lRecipients[recipient].add(redeemableAmount)
            :
            ownerAccount.lRecipients[recipient].sub(redeemableAmount);
        recipientAccount.lDebt = e.args.isDistribution ?
            recipientAccount.lDebt.add(redeemableAmount)
            :
            recipientAccount.lDebt.sub(redeemableAmount);
        recipientAccount.sInternalAmount = e.args.isDistribution ?
            recipientAccount.sInternalAmount.add(sInternalAmount)
            :
            recipientAccount.sInternalAmount.sub(sInternalAmount);
    });
    return accounts;
};
