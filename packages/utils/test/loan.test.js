// // var test = require('mocha').describe;
// // var assert = require('chai').assert;
// var expect = require('expect.js');
//
// import { getRutils } from './utils/client';
// import { getUsers } from './utils/users';
//
// const rutils = getRutils();
// const users = getUsers();
// const { customer1, customer2, customer3 } = users;
//
// // before(function () {
// // });
//
// describe('Tests basic user lookup', () => {
//   it('should successfully get a single account details', async () => {
//     const user = rutils.user({
//       address: customer1.address,
//     });
//     const details = await user.details();
//     expect(details.id).to.be(customer1.address);
//   });
// });
