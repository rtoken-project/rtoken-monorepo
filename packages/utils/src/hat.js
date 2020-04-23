async receivedSavingsOfByHat(hatID) {
  const rdai = await getContract('rdai');
  const { recipients } = await rdai.getHatByID(hatID);
  let savingsSum = bigNumberify(0);
  if (recipients && recipients.length) {
    for (let i = 0; i < recipients.length; i++) {
      const amountBN = await rdai.receivedSavingsOf(recipients[i]);
      savingsSum = savingsSum.add(amountBN);
    }
  }
  return savingsSum.toString();
}
async amountEarnedByHat(hatID) {
  const rdai = await getContract('rdai');
  const { recipients } = await rdai.getHatByID(hatID);
  let totalEarned = bigNumberify(0);
  if (recipients && recipients.length) {
    for (let i = 0; i < recipients.length; i++) {
      const balanceBN = await rdai.balanceOf(recipients[i]);
      const interestBN = await rdai.interestPayableOf(recipients[i]);
      totalEarned = totalEarned.add(interestBN).add(balanceBN);
    }
  }
  return totalEarned.toString();
}
async getHatIDByAddress(address) {
  const rdai = await getContract('rdai');
  const hat = await rdai.getHatByAddress(address);
  let hatID = null;
  if (hat) hatID = hat.hatID.toString();
  return hatID;
}
async allUsersWithHat(hatID) {
  const operation = {
    query: gql`
      query allUsersWithHat($hatID: String) {
        accounts(
          where: {
            id_not: "0x0000000000000000000000000000000000000000"
            hat: $hatID
          }
        ) {
          id
          balance
          hat {
            id
          }
        }
      }
    `,
    variables: {
      hatID: hatID,
    },
  };
  let res = await makePromise(execute(this.client, operation));
  let accounts = [];
  let topDonor = {
    balance: 0,
    id: '',
  };
  if (res.data && res.data.accounts) {
    accounts = res.data.accounts;
    for (let i = 0; i < accounts.length; i++) {
      if (JSON.parse(accounts[i].balance) > topDonor.balance)
        topDonor = accounts[i];
    }
  }
  return { topDonor, accounts };
}
async userContributionToHat(hatID, address) {
  const currentHatID = await this.getHatIDByAddress(address);
  if (currentHatID !== hatID) return 0;
  const rdai = await getContract('rdai');
  let amount = 0;
  amount = await rdai.balanceOf(address);
  return amount.toString();
}

async getTopDonorByHatGroup(hats) {
  const hatsArray = JSON.parse(hats);
  let masterDonor = { id: 'null', balance: 0 };
  if (hatsArray && hatsArray.length) {
    for (let i = 0; i < hatsArray.length; i++) {
      const { topDonor } = await this.allUsersWithHat(
        hatsArray[i].toString()
      );

      if (topDonor.balance > masterDonor.balance) masterDonor = topDonor;
    }
  }
  return masterDonor;
}
async sortHatsByReceivedSavingsOf(hats) {
  const hatsArray = JSON.parse(hats);
  const rdai = await getContract('rdai');
  let hatObjectsArray = [];
  if (hatsArray && hatsArray.length) {
    for (let i = 0; i < hatsArray.length; i++) {
      const { recipients, proportions } = await rdai.getHatByID(hatsArray[i]);
      const receivedSavingsOf = await this.receivedSavingsOfByHat(
        hatsArray[i]
      );
      hatObjectsArray.push({
        recipients,
        proportions,
        hatID: hatsArray[i],
        receivedSavingsOf,
      });
    }
  }
  hatObjectsArray.sort(function (a, b) {
    return b.receivedSavingsOf - a.receivedSavingsOf;
  });
  return hatObjectsArray;
}
