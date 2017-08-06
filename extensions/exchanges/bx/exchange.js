var BXClient = require('./caller'),
  minimist = require('minimist'),
  moment = require('moment'),
  n = require('numbro'),
  products = require('./products.json')

function getProductByProductId (product_id) {
  var asset = product_id.split('-')[0]
  var currency = product_id.split('-')[1]
  return products.filter(function (product) { return product.asset === asset && product.currency === currency})[0]
}

module.exports = function container(get, set, clear) {
  var c = get('conf')
  var s = {options: minimist(process.argv)}
  var so = s.options

  var client
  var silencedRecoverableErrors = new RegExp(/(ESOCKETTIMEDOUT|ETIMEDOUT)/)
  var shownWarning = false
  function getClient() {
    if (!client) {
      if (!c.bx || !c.bx.key || c.bx.key === 'YOUR-API-KEY') {
        throw new Error('please configure your Kraken credentials in conf.js')
      }
      client = new BXClient(c.bx.key,c.bx.secret)
    }
    return client
  }

  function retry(method, args, error) {
    var timeout, errorMsg
    if (error.message.match(/API:Rate limit exceeded/)) {
      timeout = 10000
    } else {
      timeout = 150
    }

    // silence common timeout errors
    if (so.debug || !error.message.match(silencedRecoverableErrors)) {
      if (error.message.match(/between Cloudflare and the origin web server/)) {
        errorMsg = 'Connection between Cloudflare CDN and api.kraken.com failed'
      } else {
        errorMsg = error
      }
      console.warn(('\nKraken API warning - unable to call ' + method + ' (' + errorMsg + '), retrying in ' + timeout / 1000 + 's').yellow)
    }
    setTimeout(function () {
      exchange[method].apply(exchange, args)
    }, timeout)
  }

  var orders = {}

  var exchange = {
    name: 'bx',
    historyScan: 'forward',
    makerFee: 0.25,
    takerFee: 0.25,
    // The limit for the public API is not documented, 1750 ms between getTrades in backfilling seems to do the trick to omit warning messages.
    backfillRateLimit: 1750,

    getProducts: function () {
      return products
    },
    getTrades: function (opts, cb) {
      var func_args = [].slice.call(arguments)
      var client = getClient()
      var product = getProductByProductId(opts.product_id)
      if (!product) {
        return cb('Could not find product from opts.product_id')
      }
      var args = {
        pairing: product.id
      }

      if (!shownWarning) {
        console.log('please note: do not be alarmed if you see an error "returned duplicate results"')
        console.log('please note: the bx api does not support backfilling (trade/paper only).')
        console.log('please note: make sure to set the --period=1m to make sure data for trade/paper is fetched.')
        shownWarning = true
      }
      client.getRecentTrade(args)
        .then(function (result) {
          if (!result.success) {
            return retry('getTrades', func_args, 'Something went wrong to get trade api')
          }
          let trades = result.trades.trades
          trades = trades.map(function (trade) {
            console.log({trade_id: trade.trade_id,
              time: moment(trade.trade_date, 'YYYY-MM-DD HH:mm:ss').valueOf(),
              size: parseFloat(trade.amount),
              price: parseFloat(trade.rate),
              side: trade.trade_type})
            return {
              trade_id: trade.trade_id,
              time: moment(trade.trade_date, 'YYYY-MM-DD HH:mm:ss').valueOf(),
              size: parseFloat(trade.amount),
              price: parseFloat(trade.rate),
              side: trade.trade_type
            }
          })
          cb(null, trades)
        })
    },

    getBalance: function (opts, cb) {
      var args = [].slice.call(arguments)
      let client = getClient()
      client.getBalance()
        .then(function (result) {
          var balance = {
            asset: 0,
            currency: 0
          }
          if (!result.success) {
            if (result.recoverable) {
              return retry('getBalance', args, result.error)
            }
            console.error(('\ngetBalance error:').red)
            console.error(result.error)
            return cb(result.error)
          }
          if (result.balance[opts.product.currency]) {
            balance.currency = n(result.balance[opts.product.currency].available).format('0.00000000')
            balance.currency_hold = 0
          }
          if (result.balance[opts.product.asset]) {
            balance.asset = n(result.balance[opts.product.asset].available).format('0.00000000')
            balance.asset_hold = 0
          }
          cb(null, balance)
          return
        })
    },

    getQuote: function (opts, cb) {
      var args = [].slice.call(arguments)
      var client = getClient()
      var pair = opts.product.id
      client.getTicker()
        .then(function (result) {
          if (!result.success) {
            if (result.recoverable) {
              return retry('getQuote', args, result.error)
            }
            console.error(('\ngetQuote error:').red)
            console.error(result.error)
            return cb(result.error)
          }
          let ticker = result.ticker[pair]
          cb(null, {
            bid: ticker.orderbook.bids.highbid,
            ask: ticker.orderbook.asks.highbid
          })
        })
    },

    cancelOrder: function (opts, cb) {
      var args = [].slice.call(arguments)
      var client = getClient()
      var product = getProductByProductId(opts.product_id)
      client.cancelOrder({order_id: opts.order_id, pairing: product.id})
        .then(function (result) {
          if (!result.success) {
            if (result.error.recoverable) {
              return retry('cancelOrder', args, result.error)
            }
            console.error(('\ncancelOrder error:').red)
            console.error(result.error)
            return cb(result.error)
          }
          if (so.debug) {
            console.log('cancelOrder')
            console.log(result)
          }
          cb(result.error)
        })
    },

    trade: function (type, opts, cb) {
      var args = [].slice.call(arguments)
      var client = getClient()
      var product = getProductByProductId(opts.product_id)
      var params = {
        pairing: product.id,
        type: type,
        amount: opts.size,
        rate: opts.price,
      }
      if (opts.post_only === true && params.ordertype === 'limit') {
        params.oflags = 'post'
      }
      if ('price' in opts) {
        params.price = opts.price
      }
      if (so.debug) {
        console.log('trade')
        console.log(params)
      }
      client.createOrder(params)
        .then(function (result) {
          if (!result.success && result.recoverable) {
            return retry('trade', args, result.error)
          }

          var order = {
            id: result.order_id || null,
            status: 'open',
            price: opts.price,
            size: opts.size,
            created_at: new Date().getTime(),
            filled_size: '0'
          }

          if (opts.order_type === 'maker') {
            order.post_only = !!opts.post_only
          }

          if (so.debug) {
            console.log('Data')
            console.log(result)
            console.log('Order')
            console.log(order)
            console.log('Error')
            console.log(result.error)
          }

          // Need to test for getting error message
          // if (error) {
          //   if (error.message.match(/Order:Insufficient funds$/)) {
          //     order.status = 'rejected'
          //     order.reject_reason = 'balance'
          //     return cb(null, order)
          //   } else if (error.message.length) {
          //     console.error(('\nUnhandeld AddOrder error:').red)
          //     console.error(error)
          //     order.status = 'rejected'
          //     order.reject_reason = error.message
          //     return cb(null, order)
          //   } else if (data.error.length) {
          //     console.error(('\nUnhandeld AddOrder error:').red)
          //     console.error(data.error)
          //     order.status = 'rejected'
          //     order.reject_reason = data.error.join(',')
          //   }
          // }

          orders['~' + result.order_id] = order
          cb(null, order)
        })
    },

    buy: function (opts, cb) {
      exchange.trade('buy', opts, cb)
    },

    sell: function (opts, cb) {
      exchange.trade('sell', opts, cb)
    },

    getOrder: function (opts, cb) {
      var args = [].slice.call(arguments)
      var order = orders['~' + opts.order_id]
      if (!order) return cb(new Error('order not found in cache'))
      var client = getClient()
      var product = getProductByProductId(opts.product_id)

      var params = {
        pairing: product.id
      }
      client.getOrders(params)
        .then(function (result) {
          if (!result.success) {
            if (result.recoverable) {
              return retry('getOrder', args, result.error)
            }
            console.error(('\ngetOrder error:').red)
            console.error(result.error)
            return cb(result.error)
          }
          var orderData = result.orders.filter(function (orderData) { return orderData.order_id === opts.order_id})[0]
          if (so.debug) {
            console.log('QueryOrders')
            console.log(result.orders)
          }

          if (!orderData) {
            order.status = 'done'
            order.done_at = new Date().getTime()
            order.filled_size = n(orderData.vol_exec).format('0.00000000')
          }

          cb(null, order)
        })
    },

    // return the property used for range querying.
    getCursor: function (trade) {
      return Math.floor((trade.time || trade) / 1000)
    }
  }
  return exchange
}
