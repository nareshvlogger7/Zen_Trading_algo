const axios = require('axios');
const moment = require('moment');
const { tokenLookup } = require('./utils'); // assuming utils.js has a tokenLookup function

class YesterdayRangeBreakout {
    constructor(smartApi, instrumentList) {
        this.smartApi = smartApi;
        this.instrumentList = instrumentList;
    }

    async rangeBreakout(tickers, exchange = 'NSE') {
        for (const ticker of tickers) {
            await new Promise(resolve => setTimeout(resolve, 400)); // Sleep for 400ms

            const params = {
                exchange: exchange,
                symboltoken: tokenLookup(ticker, this.instrumentList),
                interval: 'ONE_DAY',
                fromdate: moment().subtract(1, 'day').format('YYYY-MM-DD HH:mm'),
                todate: moment().format('YYYY-MM-DD HH:mm'),
            };

            try {
                const histDataResponse = await this.smartApi.getCandleData(params);
                const histData = histDataResponse.data;

                if (histData && histData.length > 0) {
                    const dfData = histData.map(item => ({
                        date: item[0],
                        open: item[1],
                        high: item[2],
                        low: item[3],
                        close: item[4],
                        volume: item[5],
                    }));

                    const highs = dfData.map(data => data.high);
                    console.log(highs);
                }
            } catch (error) {
                console.error(error);
            }
        }
    }
}

module.exports = YesterdayRangeBreakout;
