const express = require('express');
const router = express.Router();
const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");
const dbo = require('../db/conn');

const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
      "Plaid-Version": "2020-09-14",
    },
  },
});

const client = new PlaidApi(config);

router.get("/create_link_token", async (req, res, next) => {
  const tokenResponse = await client.linkTokenCreate({
    user: { client_user_id: req.sessionID },
    client_name: "Theo Test Finance",
    language: "en",
    products: ["auth", "transactions"],
    country_codes: ["US"],
  });
  res.json(tokenResponse.data);
});

router.post("/exchange_public_token", async (req, res, next) => {
  const exchangeResponse = await client.itemPublicTokenExchange({
    public_token: req.body.public_token,
  });
  const pfDb = await dbo.getDb();
  const banks = pfDb.collection("banks");
  await banks.insertOne({
    name: req.body.metadata.institution.name,
    access_token: exchangeResponse.data.access_token,
    item_id: exchangeResponse.data.item_id,
  });

  res.json(true);
});

router.get("/balance", async (req, res, next) => {
  const pfDb = await dbo.getDb();
  const banks = pfDb.collection("banks");
  const bankAccount = await banks.findOne({ name: req.query.accountName });
  const access_token = bankAccount.access_token;

  const balanceResponse = await client.accountsBalanceGet({ access_token });
  const accountData = balanceResponse.data.accounts.map((account) => {
    return {
      id: account.account_id,
      name: account.name,
      balance: account.balances.current,
      subtype: account.subtype,
    };
  });

  await banks.updateOne(
    { name: req.query.accountName },
    { $set: { accounts: accountData } }
  );

  res.json({
    balance: accountData,
  });
});

router.get("/transactions", async (req, res, next) => {
  const pfDb = await dbo.getDb();
  const banks = pfDb.collection("banks");
  const bankName = req.query.accountName;
  const bankAccount = await banks.findOne({ name: bankName });
  const access_token = bankAccount.access_token;
  const startDate = bankAccount.txns_up_to_date || "2022-09-01";
  const endDate = new Date().toISOString().slice(0, 10);
  try {
    const response = await client.transactionsGet({
      access_token,
      start_date: startDate,
      end_date: endDate,
    });
    let transactions = response.data.transactions;
    const total_transactions = response.data.total_transactions;
    while (transactions.length < total_transactions) {
      const paginatedResponse = await client.transactionsGet({
        access_token,
        start_date: startDate,
        end_date: endDate,
        options: {
          offset: transactions.length,
        },
      });
      transactions = transactions.concat(paginatedResponse.data.transactions);
    }
    const txns = pfDb.collection("txns");
    transactions = transactions.map((transaction) => {
      return {
        account_id: transaction.account_id,
        date: transaction.date,
        amount: transaction.amount,
        name: transaction.merchant_name || transaction.name,
        category: transaction.category,
        payment_channel: transaction.payment_channel,
      };
    });

    await txns.insertMany(transactions);
    await banks.updateOne(
      { name: bankName },
      { $set: { txns_up_to_date: endDate } }
    );

    res.json({ transactions });
  } catch (err) {
    console.log(err);
    res.json(err);
  }
});

module.exports = router;
