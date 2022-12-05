/*
server.js – Configures the Plaid client and uses Express to defines routes that call Plaid endpoints in the Sandbox environment.
Utilizes the official Plaid node.js client library to make calls to the Plaid API.
*/

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");
const app = express();

const username = encodeURIComponent(process.env.MONGO_USERNAME);
const password = encodeURIComponent(process.env.MONGO_PASSWORD);
const { MongoClient } = require('mongodb');
const uri = `mongodb+srv://${username}:${password}@cluster0.0ogzbz4.mongodb.net/?retryWrites=true&w=majority`;
const dbClient = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


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
  const pfDb = await dbClient.connect()
  const banks = pfDb.db("personal-finance").collection("banks");
  await banks.insertOne({
    name: req.body.metadata.institution.name,
    access_token: exchangeResponse.data.access_token,
    item_id: exchangeResponse.data.item_id,
  });

  res.json(true);
});

app.get("/api/bank_accounts", async (req, res, next) => {
  const pfDb = await dbClient.connect()
  const banks = pfDb.db("personal-finance").collection("banks").find();
  const bankAccounts = [];
  await banks.forEach((bank) => {
    console.log('bank', bank);
    bankAccounts.push(bank);
  });
  res.json(bankAccounts);
});

app.get("/api/balance", async (req, res, next) => {
  const bankAccount = await banksDb.doc(req.query.accountName).get()
  const access_token = bankAccount.data().access_token;
  const bankName = bankAccount.id;

  const balanceResponse = await client.accountsBalanceGet({ access_token });
  const accounts = banksDb.doc(bankName).collection('accounts');
  console.log(balanceResponse.data.accounts);
  balanceResponse.data.accounts.forEach(account => (
    accounts.doc(account.account_id).set({
      balance: account.balances.current,
      account_name: account.name,
      subtype: account.subtype,
    })
  ));
  
  res.json({
    balance: balanceResponse.data,
  });
});

app.get("/api/transactions", async (req, res, next)  => {
  const bankAccount = await banksDb.doc(req.query.accountName).get();
  const accessToken = bankAccount.data().access_token;
  const bankName = bankAccount.id;
  const startDate = bankAccount.data().txns_up_to_date || '2022-09-01'
  const endDate = new Date().toISOString().slice(0, 10);
  try {
    const response = await client.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate
    });
    let transactions = response.data.transactions;
    const total_transactions = response.data.total_transactions;
    while (transactions.length < total_transactions) {
      const paginatedResponse = await client.transactionsGet({
        access_token: accessToken,
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
    const accounts = banksDb.doc(bankName).collection('accounts');
    transactions.forEach(transaction => {
      accounts.doc(transaction.account_id).collection('txns')
      .doc().set({
        date: transaction.date,
        amount: transaction.amount,
        name: transaction.merchant_name || transaction.name,
        category: transaction.category,
        payment_channel: transaction.payment_channel,
      });
    });
    await banksDb.doc(bankName).set({
      txns_up_to_date: endDate
    }, { merge: true });
    res.json({transactions});
  } catch(err) {
    console.log(err)
    res.json(err);
  }
});

app.listen(8080);
