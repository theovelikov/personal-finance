/*
server.js – Configures the Plaid client and uses Express to defines routes that call Plaid endpoints in the Sandbox environment.
Utilizes the official Plaid node.js client library to make calls to the Plaid API.
*/

require("dotenv").config();
const express = require("express");
const session = require("express-session");
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

app.use(session({ secret: "test secret", saveUninitialized: true, resave: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));


const dbRoutes = require('./routes/database');
const plaidRoutes = require("./routes/plaid");

app.use("/db", dbRoutes);
app.use("/plaid", plaidRoutes);









