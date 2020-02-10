module.exports = async function (contract, eventName, startFromBlock) {
    let events = [];
    let fromBlock = 0;
    let lastBlockNumber = startFromBlock;
    while (fromBlock < lastBlockNumber) {
        //console.log("!!!", fromBlock, lastBlockNumber);
        fromBlock = lastBlockNumber;
        let newEvents = await contract.getPastEvents(eventName, {
            fromBlock,
            toBlock: "latest"
        });
        if (newEvents.length === 0) break;
        lastBlockNumber = newEvents[newEvents.length - 1].blockNumber;
        if (fromBlock < lastBlockNumber) {
            // remove new events of the last block
            newEvents = newEvents.filter(e => e.blockNumber !== lastBlockNumber);
        } // else assuming we fetch the entire last block!
        events = events.concat(newEvents);
    }
    return events;
};
