/*
server.js – Configures the Plaid client and uses Express to defines routes that call Plaid endpoints in the Sandbox environment.
Utilizes the official Plaid node.js client library to make calls to the Plaid API.
*/

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");
const app = express();

const { getFirestore } = require('firebase-admin/firestore');
const admin = require("firebase-admin");
const serviceAccount = require("./personal-finance-348e9-firebase-adminsdk-doi01-7421efa714.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore();
const banksDb = db.collection('banks');

app.get('/api/get_access_token', async (req, res, next) =>{
  const banks = await banksDb.get();
  if (banks.size === 0) {
    res.json(false)
  } else {
    res.json(banks.docs[0].data().access_token)
  }
})


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

  await banksDb.doc().set({
    bank_name: 'chase',
    access_token: exchangeResponse.data.access_token,
    item_id: exchangeResponse.data.item_id,
  });

  res.json(true);
});

app.get("/api/balance", async (req, res, next) => {
  const banks = await banksDb.get();
  const access_token = banks.docs[0].data().access_token;
  const balanceResponse = await client.accountsBalanceGet({ access_token });
  res.json({
    balance: balanceResponse.data,
  });
});

app.get("/api/transactions", async (req, res, next)  => {
  const banks = await banksDb.get();
  const accessToken = banks.docs[0].data().access_token;
  try {
    const response = await client.transactionsGet({
      access_token: accessToken,
      start_date: '2018-01-01',
      end_date: '2022-10-01'
    });
    let transactions = response.data.transactions;
    const total_transactions = response.data.total_transactions;
    while (transactions.length < total_transactions) {
      const paginatedResponse = await client.transactionsGet({
        access_token: accessToken,
        start_date: '2018-01-01',
        end_date: '2022-10-01',
        options: {
          offset: transactions.length,
        },
      });
      transactions = transactions.concat(
        paginatedResponse.data.transactions,
      );
    }
    res.json({
      transactions: transactions,
    });
  } catch(err) {
    console.log(err)
    res.json(err);
  }
});

app.listen(8080);
