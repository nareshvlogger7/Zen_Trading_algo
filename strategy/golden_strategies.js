const pandas = require('pandas-js');
const yahooFinance = require('yahoo-finance');
const { LinearRegression, LogisticRegression } = require('ml-regression');
const math = require('mathjs');

function linearRegression(train, test) {
    // Creating the columns of independent variables
    train.assign({
        'H-C': train.get('High').subtract(train.get('Close')),
        'C-L': train.get('Close').subtract(train.get('Low')),
        'H-Ht-1': train.get('High').subtract(train.get('High').shift(1)),
        'L-Lt-1': train.get('Low').subtract(train.get('Low').shift(1))
    });

    let x = train.select(['H-C', 'C-L', 'H-Ht-1', 'L-Lt-1']).iloc(0, -1).dropna();
    let y = train.select(['Close']).shift(-1).iloc(1, -1);

    const linearModel = new LinearRegression(x.values(), y.values());
    linearModel.train(x, y);

    test.assign({
        'H-C': test.get('High').subtract(test.get('Close')),
        'C-L': test.get('Close').subtract(test.get('Low')),
        'H-Ht-1': test.get('High').subtract(test.get('High').shift(1)),
        'L-Lt-1': test.get('Low').subtract(test.get('Low').shift(1))
    });
    test.dropna();

    const coefs = linearModel.coefficients;

    test.assign({
        'Predicted': test.get('Close').add(
            test.get('H-C').multiply(coefs[0]).add(
                test.get('C-L').multiply(coefs[1]).add(
                    test.get('H-Ht-1').multiply(coefs[2]).add(
                        test.get('L-Lt-1').multiply(coefs[3])
                    )
                )
            )
        )
    });

    test.assign({
        'Entry': test.get('Predicted').shift(1).lt(test.get('Predicted')) ? test.get('Close') : 0,
        'Exit': 0
    });

    test.assign({
        'Exit': test.get('Entry').notEquals(0).and(test.get('Open').shift(-1).lt(test.get('Close')))
            ? test.get('Open').shift(-1)
            : test.get('Exit')
    });

    test.assign({
        'P&L_LR': test.get('Exit').subtract(test.get('Entry')),
        'Equity curve LR': test.get('P&L_LR').cumsum().add(parseInt(test.get('Close').iloc(0)))
    });

    return test;
}

function logisticRegression(train, test) {
    train.assign({
        'C-L > H-C': train.get('Close').subtract(train.get('Low')).gt(train.get('High').subtract(train.get('Close'))) ? 1 : 0,
        'H > Ht-1': train.get('High').gt(train.get('High').shift(1)) ? 1 : 0
    });

    const x_train = train.select(['C-L > H-C', 'H > Ht-1']);
    const y_train = train.get('Close').shift(-1);

    const logisticModel = new LogisticRegression(x_train.values(), y_train.values());
    logisticModel.train(x_train, y_train);

    test.assign({
        'C-L > H-C': test.get('Close').subtract(test.get('Low')).gt(test.get('High').subtract(test.get('Close'))) ? 1 : 0,
        'H > Ht-1': test.get('High').gt(test.get('High').shift(1)) ? 1 : 0
    });

    const x_test = test.select(['C-L > H-C', 'H > Ht-1']);
    test.assign({
        'Predicted': logisticModel.predict(x_test.values())
    });

    return test;
}

// Buying and selling conditions
function shouldBuyLR(currentPrice, previousHigh, previousLow, currentVolume, averageVolume) {
    return currentPrice > previousHigh && currentVolume > averageVolume;
}

function shouldSellLR(currentPrice, previousHigh, previousLow, currentVolume, averageVolume) {
    return currentPrice < previousLow && currentVolume > averageVolume;
}

function shouldBuyLG(currentPrice, previousHigh, previousLow, currentVolume, averageVolume) {
    return currentPrice > previousHigh && currentVolume > averageVolume;
}

function shouldSellLG(currentPrice, previousLow, previousVolume, averageVolume) {
    return currentPrice < previousLow && currentVolume > averageVolume;
}
