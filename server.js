/*
server.js – Configures the Plaid client and uses Express to defines routes that call Plaid endpoints in the Sandbox environment.
Utilizes the official Plaid node.js client library to make calls to the Plaid API.
*/

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");
const app = express();
const dbo = require('./db/conn');
dbo.connectToServer((err) => {
  if (err) {
    console.error(err);
    process.exit();
  }

  // start the Express server
  app.listen(8080, () => {
    console.log(`Server is running on port: ${8080}`);
  });
});

app.use(
  session({ secret: "test secret", saveUninitialized: true, resave: true })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));


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

app.get("/api/create_link_token", async (req, res, next) => {
  const tokenResponse = await client.linkTokenCreate({
    user: { client_user_id: req.sessionID },
    client_name: "Theo Test Finance",
    language: "en",
    products: ["auth", 'transactions'],
    country_codes: ["US"],
  });
  res.json(tokenResponse.data);
});

app.post("/api/exchange_public_token", async (req, res, next) => {
  const exchangeResponse = await client.itemPublicTokenExchange({
    public_token: req.body.public_token,
  });
  const pfDb = await dbo.getDb()
  const banks = pfDb.collection("banks");
  await banks.insertOne({
    name: req.body.metadata.institution.name,
    access_token: exchangeResponse.data.access_token,
    item_id: exchangeResponse.data.item_id,
  });

  res.json(true);
});

app.get("/api/db/bank_accounts", async (req, res, next) => {
  const pfDb = await dbo.getDb()
  const banks = pfDb.collection("banks").find();
  const bankAccounts = [];
  await banks.forEach((bank) => {
    bankAccounts.push(bank);
  });
  res.json(bankAccounts);
});

app.get("/api/db/transactions", async (req, res, next) => {
  const pfDb = await dbo.getDb()
  const txns = pfDb.collection('txns').find();
  const transactions = [];
  await txns.forEach((txn) => {
    transactions.push(txn);
  });
  res.json(transactions);
});

app.get("/api/balance", async (req, res, next) => {
  const pfDb = await dbo.getDb()
  const banks = pfDb.collection("banks");
  const bankAccount = await banks.findOne({ name: req.query.accountName })
  const access_token = bankAccount.access_token;

  const balanceResponse = await client.accountsBalanceGet({ access_token });
  const accountData = balanceResponse.data.accounts.map((account) => {
    return {
      id: account.account_id,
      name: account.name,
      balance: account.balances.current,
      subtype: account.subtype
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

app.get("/api/transactions", async (req, res, next)  => {
  const pfDb = await dbo.getDb()
  const banks = pfDb.collection("banks");
  const bankName = req.query.accountName;
  const bankAccount = await banks.findOne({ name: bankName })
  const access_token = bankAccount.access_token;
  const startDate = bankAccount.txns_up_to_date || '2022-09-01'
  const endDate = new Date().toISOString().slice(0, 10);
  try {
    const response = await client.transactionsGet({
      access_token,
      start_date: startDate,
      end_date: endDate
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
      transactions = transactions.concat(
        paginatedResponse.data.transactions,
      );
    }
    const txns = pfDb.collection('txns');
    transactions = transactions.map((transaction) => { 
      return {
        account_id: transaction.account_id,
        date: transaction.date,
        amount: transaction.amount,
        name: transaction.merchant_name || transaction.name,
        category: transaction.category,
        payment_channel: transaction.payment_channel,
      }
    });

    await txns.insertMany(transactions);
    await banks.updateOne({name: bankName}, { $set: { txns_up_to_date: endDate }})

    res.json({transactions});
  } catch(err) {
    console.log(err)
    res.json(err);
  }
});


