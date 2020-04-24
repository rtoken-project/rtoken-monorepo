const fs = require('fs')
const RToken = require('@rtoken/contracts/build/contracts/RToken')

fs.mkdir('abis/', err => {
  if (err) {
    // console.error(err)
    return
  }
  console.log("abis/ directory created");
})
fs.writeFile('abis/RToken.json', JSON.stringify(RToken), err => {
  if (err) {
    console.error(err)
    return
  }
  console.log("abi files updated");
})
