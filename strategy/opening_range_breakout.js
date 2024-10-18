const axios = require('axios');
const moment = require('moment-timezone'); // For date formatting
const AngelOneClient = require('./src/trademaster/broker/AngelOneClient');
const { token_lookup, Colors } = require('./src/trademaster/utils');

class OpeningRangeBreakout extends AngelOneClient {
    /**
     * A class to implement Opening Range Breakout trading strategy.
     */

    async orbStrat(tickers, hiLoPrices, positions, openOrders = null, exchange = 'NSE') {
        /**
         * Implements an Opening Range Breakout (ORB) strategy for given tickers.
         *
         * @param {Array} tickers - List of ticker symbols to analyze.
         * @param {Object} hiLoPrices - Dictionary containing high and low prices for each ticker.
         * @param {Object} positions - Current positions as a DataFrame-like object.
         * @param {Object|null} openOrders - Open orders as a DataFrame-like object. Defaults to null.
         * @param {String} exchange - Name of the exchange. Defaults to "NSE".
         */
        let quantity = 3;

        if (positions.length) {
            tickers = tickers.filter(ticker => !positions.map(p => p.tradingsymbol).includes(`${ticker}-EQ`));
        }

        if (openOrders && openOrders.length) {
            tickers = tickers.filter(ticker => !openOrders.map(o => o.tradingsymbol).includes(`${ticker}-EQ`));
        }

        for (const ticker of tickers) {
            await new Promise(resolve => setTimeout(resolve, 400)); // Sleep for 0.4 seconds

            let params = {
                exchange: exchange,
                symboltoken: token_lookup('WIPRO', this.instrument_list),
                interval: 'FIVE_MINUTE',
                fromdate: moment().subtract(4, 'days').format('YYYY-MM-DD HH:mm'),
                todate: moment().format('YYYY-MM-DD HH:mm')
            };

            try {
                let histData = await this.smart_api.getCandleData(params);

                let dfData = histData.data.map(row => ({
                    date: row[0],
                    open: row[1],
                    high: row[2],
                    low: row[3],
                    close: row[4],
                    volume: row[5]
                }));

                // Calculate rolling average volume and add to the data
                dfData = dfData.map((row, index, arr) => ({
                    ...row,
                    avg_vol: index >= 10 ? arr.slice(index - 10, index).reduce((sum, item) => sum + item.volume, 0) / 10 : null
                }));

                const lastData = dfData[dfData.length - 1];
                const avgVolume = lastData.avg_vol;

                console.log('current_volume: ', lastData.volume, 'average volume: ', avgVolume);

                if (lastData.volume > avgVolume) {
                    if (lastData.close > hiLoPrices[ticker].high) {
                        await this.placeOrder('BUY', ticker, quantity);
                    } else if (lastData.close < hiLoPrices[ticker].low) {
                        await this.placeOrder('SELL', ticker, quantity);
                    }
                }
            } catch (err) {
                console.error(`Failed to execute strategy for ${ticker}:`, err);
            }
        }
    }
}

module.exports = OpeningRangeBreakout;
