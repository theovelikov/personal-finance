import React, { useState, useCallback, useEffect } from 'react';
import './styles/App.css';
import {
  usePlaidLink,
  PlaidLinkOptions,
  PlaidLinkOnSuccess,
} from 'react-plaid-link';

function App() {
  const [linkToken, setLinkToken] = useState('');
  const [data, setData] = useState(null);
  const [transactions, setTransactions] = useState(null);

  const createLinkToken = useCallback(async () => {
    const response = await fetch("/api/create_link_token", {});
    const data = await response.json();
    setLinkToken(data.link_token);
  }, [setLinkToken])

  // const getAccessToken = useCallback(async () => {
  //   const response = await fetch("/api/get_access_token", {});
  //   const data = await response.json();
  //   console.log(data)
  //   setAccessToken(data);
  // }, [setAccessToken])

  const getBalance = useCallback(async () => {
    const response = await fetch("/api/balance", {});
    const data = await response.json();
    console.log(data)
    setData(data.balance);
  }, [setData])

  const getTransactions = useCallback(async () => {
    const response = await fetch("/api/transactions", {});
    const data = await response.json();
    console.log(data)
    setTransactions(data.transactions);
  }, [setTransactions])

  const exchangePublicToken = useCallback(async (public_token: string) => {
    const response = await fetch("/api/exchange_public_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ public_token: public_token }),
    });
  }, [])

  const config: PlaidLinkOptions = {
    onSuccess: (public_token, metadata) => { exchangePublicToken(public_token) },
    onExit: (err, metadata) => {},
    onEvent: (eventName, metadata) => {},
    token: linkToken,
  };

  const { open, ready, exit } = usePlaidLink(config);

  useEffect(() => {
    if(linkToken === ''){
      createLinkToken()
    }
  })

  return (
    <div className="app">
      <div >
        <div className='header'>
          <button onClick={() => open()}>
            Link Account
          </button>

          <button onClick={() => getBalance()} >
            Get Data
          </button>

          <button onClick={() => getTransactions()} >
            Get Transactions
          </button>
        </div>
        <div className="container">
        { data != null &&
          Object.entries(data).map((entry, i) => (
            <div key={i}>
              <code>{JSON.stringify(entry[1], null, 2)}</code>
            </div>
          )
        )}
        { transactions != null &&
          Object.entries(transactions).map((transaction, i) => (
            <div key={i}>
              <code>{JSON.stringify(transaction)}</code>
            </div>
          )
        )}
        </div>
      </div>
    </div>
  );
}

export default App;
