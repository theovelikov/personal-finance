const express = require('express');
const router = express.Router();
const dbo = require('../db/conn');

router.get("/bank_accounts", async (req, res, next) => {
  const pfDb = await dbo.getDb();
  const banks = pfDb.collection("banks").find();
  const bankAccounts = [];
  await banks.forEach((bank) => {
    bankAccounts.push(bank);
  });
  res.json(bankAccounts);
});

router.get("/transactions", async (req, res, next) => {
  const pfDb = await dbo.getDb();
  const txns = pfDb.collection("txns").find();
  const transactions = [];
  await txns.forEach((txn) => {
    transactions.push(txn);
  });
  res.json(transactions);
});

module.exports = router;