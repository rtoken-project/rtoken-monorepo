const { promisify } = require("util");
const readline = require("readline");

// promisify the readline
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
// Prepare readline.question for promisification
rl.question[promisify.custom] = (question) => {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
};

module.exports = rl;
