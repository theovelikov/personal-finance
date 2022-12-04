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


// Configuration for the Plaid client
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

//Instantiate the Plaid client with the configuration
const client = new PlaidApi(config);

//Creates a Link token and return it
app.get("/api/create_link_token", async (req, res, next) => {
  const tokenResponse = await client.linkTokenCreate({
    user: { client_user_id: req.sessionID },
    client_name: "Theo Test Finance",
    language: "en",
    products: ["auth"],
    country_codes: ["US"],
  });
  res.json(tokenResponse.data);
});

// Exchanges the public token from Plaid Link for an access token
app.post("/api/exchange_public_token", async (req, res, next) => {
  const exchangeResponse = await client.itemPublicTokenExchange({
    public_token: req.body.public_token,
  });

  await banksDb.doc().set({
    bank_name: 'chase',
    access_token: exchangeResponse.data.access_token,
  });

  res.json(true);
});

// Fetches balance data using the Node client library for Plaid
app.get("/api/balance", async (req, res, next) => {
  const banks = await banksDb.get();
  const access_token = banks.docs[0].data().access_token;
  const balanceResponse = await client.accountsBalanceGet({ access_token });
  res.json({
    balance: balanceResponse.data,
  });
});

app.listen(8080);
