const validation = require("../validation.js");
const environment = require('../environment');
const { ObjectId } = require("mongodb");
const axios = require('axios').default;
const mongoCollections = require('../config/mongoCollections');
const users = mongoCollections.users;
const userData = require('./users.js');


async function getStockBySymbol(symbol) {
  //error check
  validation.checkSymbol(symbol);
  symbol = symbol.toLowerCase();
  symbol = symbol.trim();
  
  //get token from environment
  const token = environment.token;

  //data provided by IEX Cloud
  //https://iexcloud.io/
  const url = `https://cloud.iexapis.com/stable/tops?token=${token}&symbols=${symbol}`;
  const { data } = await axios.get(url);
  return data;

  /*
  EXAMPLE OF WHAT THE DATA RETURNED WILL BE GIVEN symbol = 'aapl'
      [
          {
              "symbol": "AAPL",
              "sector": "electronictechnology",
              "securityType": "cs",
              "bidPrice": 158.71,
              "bidSize": 164,
              "askPrice": 158.73,
              "askSize": 400,
              "lastUpdated": 1650994885662,
              "lastSalePrice": 158.73,
              "lastSaleSize": 100,
              "lastSaleTime": 1650994877371,
              "volume": 999655
          }
      ]
  */
}

async function getQuote(symbol) {
    // validate inputs
    validation.checkSymbol(symbol);

    // format inputs
    symbol = symbol.trim().toLowerCase();

    const token = environment.token;

    //data provided by IEX Cloud
    //https://iexcloud.io/
    const url = `https://cloud.iexapis.com/stable/stock/${symbol}/quote?token=${token}`;
    const { data } = await axios.get(url);
    return data;
}


// called when a user wants to buy a stock
async function buyStock(userId, symbol, shares) { // TODO: STILL NEED TO DEAL WITH BOUNDS i.e. user doesn't have enough money
    // validate inputs
    validation.checkId(userId);
    validation.checkSymbol(symbol);
    validation.checkShares(shares);
    
    // get user collection for updating
    const userCollection = await users();

    // format inputs
    userId = userId.trim();
    symbol = symbol.trim();

    let date_time = new Date().toUTCString(); // date and time of purchase

    // get purchasing user
    const user = await userData.getUserById(userId);

    // get stock from API call
    stockApiData = await getStockBySymbol(symbol);

    // check if symbol could be found
    if(stockApiData.length < 1) throw `Could not find stock with symbol ${symbol}`;
    // api call returns an array, to get desired stock, get first element of that array
    stockData = stockApiData[0];

    // set price purchased to last sale price
    let price_purchased = stockData.lastSalePrice;
    let totalCost = price_purchased * shares; // calculate for total cost

    //checks if user has capital to buy the stock!
    if(totalCost > user.cash) throw `Cannot buy ${shares} shares of '${symbol}' worth $${totalCost.toFixed(2)}. You only have $${user.cash.toFixed(2)}`;

    // check if user owns the stock being purchased
    owned = user.stocks.filter(stock => stock.symbol === symbol);
    if(owned.length < 1) { // case: user does not own the stock being purchased
        const stockPurchased = { // create stock subdoc
            _id: ObjectId(),
            symbol: symbol,
            num_shares: shares,
            weighted_average_price: price_purchased,
            total_cost: totalCost,
            date_time: date_time // first purchase of stock
        };

        const updateInfo = await userCollection.updateOne( // update user
            { _id: ObjectId(userId) },
            {
                $inc: { cash: -totalCost }, // update cash amount
                $addToSet: { stocks: stockPurchased } // add new stock to stock
            }
        );
        // check for errors updating
        if (!updateInfo.matchedCount && !updateInfo.modifiedCount)
        throw "Could not purchase stock";
    } else { // user owns the stock being purchased
        stock = owned[0]; // get owned stock info
        avgPrice = ((stock.weighted_average_price * stock.num_shares) + (totalCost)) / (stock.num_shares + shares); // calculate weighted average price from previous average and new price

        const updateInfo = await userCollection.updateOne( // update the owned stock subdocument
            { 
                _id: ObjectId(userId),
                'stocks.symbol': symbol
            },
            {
                $inc: { 
                    cash: -totalCost, // decrement amount of cash
                    'stocks.$.num_shares': shares, // increment number of shares
                    'stocks.$.total_cost': totalCost // increment total cost
                },
                $set: {
                    'stocks.$.weighted_average_price': avgPrice // set average price to recalculated weighted average price
                }
            }
        );
        // check for errors updating
        if (!updateInfo.matchedCount && !updateInfo.modifiedCount) throw "Could not purchase stock";
    }
    // might change this return type later, for now it's just a confirmation
    return { purchased: true };
}
// called when a user wants to sell a stock
async function sellStock(userId, symbol, shares) { // TODO: STILL NEED TO DEAL WITH BOUNDS i.e. user doesn't have enough shares to sell
    // validate inputs
    validation.checkId(userId);
    validation.checkSymbol(symbol);
    validation.checkShares(shares);
    
    // get user collection for updating
    const userCollection = await users();

    // format inputs
    userId = userId.trim();
    symbol = symbol.trim();

    let date_time = new Date().toUTCString(); // date and time of purchase

    // get selling user
    const user = await userData.getUserById(userId);

    // get stock from API call
    stockApiData = await getStockBySymbol(symbol);

    // check if symbol could be found
    if(stockApiData.length < 1) throw `Could not find stock with symbol ${symbol}`;
    // api call returns an array, to get desired stock, get first element of that array
    stockData = stockApiData[0];

    // set price sold to last sale price
    let price_sold = stockData.lastSalePrice;
    let totalCost = price_sold * shares; // calculate for total cost

    // check if user owns the stock being purchased
    owned = user.stocks.filter(stock => stock.symbol === symbol);
    if(owned.length < 1) { // case: user does not own the stock being sold, cannot sell stock
        throw 'user does not own this stock';
    } else { // user owns the stock being purchased
        stock = owned[0]; // get owned stock info

        // check if selling given amount of shares sells all shares
        if(stock.num_shares - shares === 0) { // user wants to sell all shares
            const updateInfo = await userCollection.updateOne( // all shares sold, remove subdoc from stocks
                {
                    _id: ObjectId(userId),
                    'stocks.symbol': symbol
                },
                {
                    $inc: { cash: totalCost },
                    $pull: { stocks: { symbol: symbol } } 
                } // remove subdoc
            );
            if (!updateInfo.matchedCount && !updateInfo.modifiedCount) throw "Could not sell stock";
            return { sold: true }; // confirm sale
        } else if ((stock.num_shares - shares) < 0){
            let plural = (stock.num_shares==1) ? '' : 's';
            let pluralShares = (shares == 1) ? '' : 's';
            throw `Cannot sell ${shares} share${pluralShares} of ${symbol}. You only have ${stock.num_shares} share${plural}!`;
        }

        avgPrice = ((stock.weighted_average_price * stock.num_shares) - (totalCost)) / (stock.num_shares - shares); // calculate weighted average price from previous average and new price

        const updateInfo = await userCollection.updateOne( // update the owned stock subdocument
            { 
                _id: ObjectId(userId),
                'stocks.symbol': symbol
            },
            {
                $inc: { 
                    cash: totalCost, // increment amount of cash
                    'stocks.$.num_shares': -shares, // decrement number of shares
                    'stocks.$.total_cost': -totalCost // decrement total cost
                },
                $set: {
                    'stocks.$.weighted_average_price': avgPrice // set average price to recalculated weighted average price
                }
            }
        );
        // check for errors updating
        if (!updateInfo.matchedCount && !updateInfo.modifiedCount) throw "Could not sell stock";
    }
    // might change this return type later, for now it's just a confirmation
    return { sold: true };
}

async function getAccVal(userId) {
    // validate inputs
    validation.checkId(userId);
    
    // format inputs
    userId = userId.trim();

    // get user from collection
    const user =  await userData.getUserById(userId);

    let accVal = user.cash; // set initial account balance to cash balance
    for(stock of user.stocks) {
        stockApiData = await getStockBySymbol(stock.symbol); // api call for current stock info
        if(stockApiData.length < 1) throw `Could not find stock with symbol ${symbol}`; // check if symbol was found
        stockData = stockApiData[0]; // get stock object

        // increment account value by current value of each stock
        accVal += stockData.lastSalePrice * stock.num_shares;
    }

    return accVal; // return total account value
}

async function getAllAccVals() {
    const users = await userData.getAllUsers(); // get all users returned as a list
    let accVals = []; // accumulator list

    for(user of users) { // loop through all users
        let accVal = await getAccVal(user._id.toString()); // calculate user account value
        accVals.push({ username: user.username, acc_value: accVal }); // append to list
    }

    return accVals.sort((x,y) => (x.acc_value > y.acc_value) ? -1 : ((y.acc_value > x.acc_value) ? 1 : 0)); // return list sorted in decending order of account values
}

async function getUserStocks(userId) {
    // validate inputs
    validation.checkId(userId);

    // format inputs
    userId = userId.trim();

    // get user from collection
    const user = await userData.getUserById(userId);

    // return stocks field of user
    return user.stocks;
}

async function buildPortfolioTable(userId) {
    // validate inputs
    validation.checkId(userId);

    // format inputs
    userId = userId.trim();

    // get list of stock user owns
    let userStocks = await getUserStocks(userId);

    // accumulator for portfolio view
    let portfolio = [];

    for(stock of userStocks) { // build portfolio data
        let quote = await getQuote(stock.symbol);
        portfolio.push({
            symbol: stock.symbol, // stock ticker
            last_price: quote.latestPrice, // latest stock price
            gain_loss_$: (quote.change * stock.num_shares).toFixed(2), // today's gain loss
            total_gain_loss_$: ((quote.latestPrice * stock.num_shares) - stock.total_cost).toFixed(2), // total gain loss
            w_avg_price: stock.weighted_average_price.toFixed(2), // average price of purchases
            curr_value: (quote.latestPrice * stock.num_shares).toFixed(2), // current value of holdings
            quant: stock.num_shares, // number of shares owned
            cost_basis: stock.total_cost.toFixed(2) // original purchase value
        });
    }

    // return data needed to build portfolio page
    return portfolio;
}

module.exports = {
    getStockBySymbol,  
    buyStock,
    sellStock,
    getAccVal,
    getAllAccVals,
    getUserStocks,
    getQuote,
    buildPortfolioTable
}