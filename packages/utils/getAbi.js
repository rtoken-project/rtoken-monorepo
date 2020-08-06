const fs = require("fs");

const erc20 = require("@rtoken/contracts/build/contracts/ERC20");
const rtoken = require("@rtoken/contracts/build/contracts/RToken");
const ias = require("@rtoken/contracts/build/contracts/IAllocationStrategy");

fs.mkdir("./src/abis/", (err) => {
  if (err) return; //console.error(err);
  console.log("./src/abis/ directory created");
});
fs.writeFile("./src/abis/RToken.json", JSON.stringify(rtoken.abi), (err) => {
  if (err) return console.error(err);
});
fs.writeFile(
  "./src/abis/IAllocationStrategy.json",
  JSON.stringify(ias.abi),
  (err) => {
    if (err) return console.error(err);
  }
);
fs.writeFile("./src/abis/ERC20.json", JSON.stringify(erc20.abi), (err) => {
  if (err) return console.error(err);
  console.log("abi files updated");
});
