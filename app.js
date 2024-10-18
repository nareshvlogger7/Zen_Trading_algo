const express = require('express');
const axios = require('axios');
const moment = require('moment');
const { shouldBuyLR, shouldSellLR, shouldBuyLG, shouldSellLG } = require('./golden_strategies');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Initialize and get symbol token information
async function initializeSymbolTokenMap() {
    const url = 'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';
    try {
        const response = await axios.get(url);
        let tokenData = response.data;
        tokenData.forEach(row => {
            row.expiry = new Date(row.expiry);
            row.strike = parseFloat(row.strike);
        });
        return tokenData;
    } catch (err) {
        console.error('Error initializing symbol token map:', err);
    }
}

// Get token information
async function getTokenInfo(exch_seg, instrumenttype, symbol, strike_price, pe_ce) {
    let tokenData = await initializeSymbolTokenMap();
    strike_price = strike_price * 100;
    if (exch_seg === 'NFO' && (instrumenttype === 'OPTSTK' || instrumenttype === 'OPTIDX')) {
        return tokenData.find(row => 
            row.exch_seg === 'NFO' && 
            row.instrumenttype === instrumenttype && 
            row.name === symbol && 
            row.strike === strike_price && 
            row.symbol === pe_ce);
    }
    return tokenData.filter(row => row.exch_seg === 'NFO');
}

// Get candle data
async function getCandleData(obj, symbolInfo) {
    try {
        let historicParam = {
            exchange: symbolInfo.exch_seg,
            symboltoken: symbolInfo.token,
            interval: 'FIVE_MINUTE',
            fromdate: `${moment().subtract(90, 'days').format('YYYY-MM-DD')} 9:15`,
            todate: `${moment().subtract(1, 'days').format('YYYY-MM-DD')} 15:30`
        };
        let response = await obj.getCandleData(historicParam);
        let columns = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
        let candleData = response.data.map(row => {
            let dataObj = {};
            columns.forEach((col, index) => {
                dataObj[col] = row[index];
            });
            dataObj.timestamp = new Date(dataObj.timestamp);
            dataObj.symbol = symbolInfo.symbol;
            dataObj.expiry = symbolInfo.expiry;
            return dataObj;
        });
        console.log(`Done for ${symbolInfo.symbol}`);
        return candleData;
    } catch (err) {
        console.error(`Historic API failed for ${symbolInfo.symbol}:`, err);
        return [];
    }
}

// Login endpoint
app.post('/login', async (req, res) => {
    const { api_key, username, password } = req.body;
    try {
        let obj = new SmartConnect({ api_key });
        let sessionData = await obj.generateSession(username, password);
        let refreshToken = sessionData.data.refreshToken;

        let feedToken = await obj.getFeedToken();
        let userProfile = await obj.getProfile(refreshToken);

        res.status(200).json({
            message: 'Login successful',
            refresh_token: refreshToken,
            feed_token: feedToken,
            user_profile: userProfile
        });
    } catch (err) {
        res.status(500).json({ message: 'Login failed', error: err.toString() });
    }
});

// Get symbol data endpoint
app.post('/get_symbol_data', async (req, res) => {
    const { symbol, strike_price, pe_ce } = req.body;
    try {
        let tokenInfo = await getTokenInfo('NFO', 'OPTIDX', symbol, strike_price, pe_ce);
        res.status(200).json(tokenInfo);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching symbol data', error: err.toString() });
    }
});

// Get candle data endpoint
app.post('/get_candle_data', async (req, res) => {
    const { api_key, refresh_token, symbol_info } = req.body;
    try {
        let obj = new SmartConnect({ api_key });
        await obj.generateSessionWithRefreshToken(refresh_token);

        let candleData = await getCandleData(obj, symbol_info);
        res.status(200).json(candleData);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching candle data', error: err.toString() });
    }
});

// Take order endpoint
app.post('/take_order', async (req, res) => {
    const { current_price, previous_high, previous_low, current_volume, average_volume } = req.body;
    try {
        if (shouldBuyLR(current_price, previous_high, previous_low, current_volume, average_volume)) {
            placeOrder('BUY', current_price);
            return res.status(200).json({ message: 'Buy order placed using LR strategy' });
        }
        if (shouldSellLR(current_price, previous_high, previous_low, current_volume, average_volume)) {
            placeOrder('SELL', current_price);
            return res.status(200).json({ message: 'Sell order placed using LR strategy' });
        }
        if (shouldBuyLG(current_price, previous_high, previous_low, current_volume, average_volume)) {
            placeOrder('BUY', current_price);
            return res.status(200).json({ message: 'Buy order placed using LG strategy' });
        }
        if (shouldSellLG(current_price, previous_high, previous_low, current_volume, average_volume)) {
            placeOrder('SELL', current_price);
            return res.status(200).json({ message: 'Sell order placed using LG strategy' });
        }
        res.status(200).json({ message: 'No trade executed' });
    } catch (err) {
        res.status(500).json({ message: 'Error in taking order', error: err.toString() });
    }
});

function placeOrder(orderType, price) {
    console.log(`Placing ${orderType} order at ${price}`);
}

// Index route
app.get('/', (req, res) => {
    res.send('Index Page');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
