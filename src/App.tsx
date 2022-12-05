import React, { useState, useCallback, useEffect } from 'react';
import './styles/App.css';
import {
  usePlaidLink,
  PlaidLinkOptions,
  PlaidLinkOnSuccess,
} from 'react-plaid-link';
import Chart from 'chart.js/auto';

function App() {
  const [linkToken, setLinkToken] = useState('');
  const [data, setData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);

  const createLinkToken = useCallback(async () => {
    const response = await fetch("/plaid/create_link_token", {});
    const data = await response.json();
    setLinkToken(data.link_token);
  }, [setLinkToken])

  const getBalance = useCallback(async (accountName: string) => {
    setLoading(true);
    const response = await fetch(`/plaid/balance?accountName=${accountName}`, {});
    const data = await response.json();
    setData(data.balance);
    setLoading(false);
  }, [setData])

  const getTransactions = useCallback(async (accountName: string) => {
    setLoading(true);
    const response = await fetch(`/plaid/transactions?accountName=${accountName}`, {});
    const data = await response.json();
    console.log(data)
    setTransactions(data.transactions);
    setLoading(false);
  }, [setTransactions])

  const getDataBaseTransactions = useCallback(async (accountName: string) => {
    setLoading(true);
    const response = await fetch(`/db/transactions?accountName=${accountName}`, {});
    const transactions = await response.json();
    setTxns(transactions);
    setLoading(false);
  }, [setTxns])

  const getBankAccounts = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/db/bank_accounts", {});
    const data = await response.json();
    setBankAccounts(data);
    setLoading(false);
  }, [setBankAccounts]);

  const exchangePublicToken = useCallback(async (public_token: string, metadata: any) => {
    await fetch("/plaid/exchange_public_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ public_token: public_token, metadata: metadata }),
    });
  }, [])

  const config: PlaidLinkOptions = {
    onSuccess: (public_token, metadata) => { exchangePublicToken(public_token, metadata) },
    onExit: (err, metadata) => {},
    onEvent: (eventName, metadata) => {},
    token: linkToken,
  };

  const { open, ready, exit } = usePlaidLink(config);

  useEffect(() => {
    if(linkToken === ''){
      createLinkToken()
    }
    getBankAccounts();
    console.log('execute');
  }, [setBankAccounts, setLinkToken])

  return (
    <div className="app">
      <div >
        <div className='header'>
          <button onClick={() => open()}>
            Link Account
          </button>

          <button onClick={() => getBankAccounts()}>
            Get Bank Accounts
          </button>
        </div>
        <div className='bank-accounts'>
          { bankAccounts.length > 0 && bankAccounts.map((account: any) => {
            return (
              <div>
                <button onClick={() => getBalance(account.name)} disabled={loading}>
                  Get {account.name} Balance
                </button>

                <button onClick={() => getTransactions(account.name)} disabled={loading}>
                  Get {account.name} Transactions
                </button>

                <button onClick={() => getDataBaseTransactions(account.name)} disabled={loading}>
                  Get Database {account.name} Transactions
                </button>
              </div>
            )
          })}  
        </div>

        <div className="container">
          { data != null &&
            Object.entries(data).map((entry, i) => (
              <div key={i}>
                <code>{JSON.stringify(entry[1], null, 2)}</code>
              </div>
            )
          )}
          { Object.entries(transactions).map((transaction, i) => (
              <div key={i}>
                <code>{JSON.stringify(transaction)}</code>
              </div>
            )
          )}
          { txns.length > 0 &&
            txns.map((txn, i) => (
              <div key={i}>
                <code>{JSON.stringify(txn)}</code>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
