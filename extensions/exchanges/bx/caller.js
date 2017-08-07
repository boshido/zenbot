let request = require('request-promise')
let url = require('url')
let crypto = require('crypto')
const BASE_URI = 'https://bx.in.th'
const ORDER_TYPE = {
  BUY: 'buy',
  SELL: 'sell'
}
const TRANSACTION_TYPE = {
  TRADE: 'trade',
  FEE: 'fee',
  DEPOSIT: 'deposit',
  WITHDRAW: 'withdraw'
}
function validator (field, params, type, required) {
  if (!required && typeof params[field] === 'undefined') {
    return
  }
  type = type || field
  switch (type) {
    case 'pairing':
      if (!params[field]) {
        throw new Error('Require pairing ID to perform action')
      }
      break
    case 'order_id':
      if (typeof params[field] !== 'string' && typeof params[field] !== 'number') {
        throw new Error('Require order id to perform action')
      }
      break
    case 'order_type':
      if (!params[field] || (params[field] !== ORDER_TYPE.BUY && params[field] !== ORDER_TYPE.SELL)) {
        throw new Error('Require order type to perform action')
      }
      break
    case 'transaction_type':
      if (!params[field] ||
        (params[field] !== TRANSACTION_TYPE.TRADE && params[field] !== TRANSACTION_TYPE.FEE && params[field] !== TRANSACTION_TYPE.DEPOSIT && params[field] !== TRANSACTION_TYPE.WITHDRAW)
      ) {
        throw new Error('Require order type to perform action')
      }
      break
    case 'number':
      if (typeof params[field] !== 'number') {
        throw new Error('Require '+ field + ' to perform action')
      }
      break
    case 'string':
      if (typeof params[field] !== 'string') {
        throw new Error('Require '+ field + ' to perform action')
      }
      break
    case 'date':
      if (typeof params[field].getTime !== 'function') {
        throw new Error('Require '+ field + ' to perform action')
      }
      break
  }
}
class BXClient {
  constructor(apiKey, secret) {
    this.apiKey = apiKey
    this.secret = secret
  }
  __validateKey () {
    if (!this.apiKey || !this.secret) {
      throw new Error('Need to provide api key and secret key to bx client')
    }
  }
  __publicAPICaller(uri, params, method) {
    method = method || 'GET'
    let options = {
      uri: url.resolve(BASE_URI, uri),
      method: method,
      json: true,
      body: params
    }
    if (method === 'GET' && typeof params === 'object') {
      options.qs = params
    } else if (method === 'POST' && typeof params === 'object') {
      options.body = params
    }
    return request(options)
      .catch(function (err) {
        return {
          success: false,
          error: err,
          recoverable: true
        }
      })
  }
  __privateAPICaller(uri, params) {
    this.__validateKey()
    let nonce = (new Date()).getTime()
    let hash = crypto.createHash('sha256')
    hash.update(this.apiKey + nonce.toString() + this.secret)
    let signature = {
      key: this.apiKey,
      nonce: nonce,
      signature: hash.digest('hex')
    }

    return request({
      uri: url.resolve(BASE_URI, uri),
      method: 'POST',
      json: true,
      formData: params ? Object.assign(signature, params) : signature
    })
      .catch(function (err) {
        return {
          success: false,
          error: err,
          recoverable: true
        }
      })
  }
  // Public API
  getTicker () {
    return this.__publicAPICaller('api/')
      .then(function (result) {
        if (!result.success) {
          return result
        }
        return {
          success: typeof result === 'object',
          ticker: result
        }
      })
  }

  /* Get pairing
    params : {}
  */
  getParing () {
    return this.__publicAPICaller('api/pairing/')
      .then(function (result) {
        if (!result.success) {
          return result
        }
        return {
          success: typeof result === 'object',
          pairing: result
        }
      })
  }

  /* Get order book
    params : {
      pairing: integer, * REQUIRED
    }
  */
  getOrderBook (params) {
    validator('pairing', params, 'pairing', true)
    return this.__publicAPICaller('api/orderbook/', params)
  }

  /* Get recent trade
    params : {
      pairing: integer, * REQUIRED
    }
  */
  getRecentTrade (params){
    validator('pairing', params, 'pairing', true)
    return this.__publicAPICaller('api/trade/', params)
      .then(function (result) {
        if (!result.success) {
          return result
        }
        return {
          success: typeof result === 'object',
          trades: result
        }
      })
  }

  /* Get history trade data
    params : {
      pairing: integer, * REQUIRED
      date: date, * REQUIRED
    }
  */
  getHistoryTradeData (params){
    validator('pairing', params, 'pairing', true)
    validator('date', params, 'string', true)

    return this.__publicAPICaller('api/tradehistory/', {pairing: params.pairing, date: params.date})
  }

  /*
   * Private API
   */

  /* Create order
    params : {
      pairing: integer, * REQUIRED
      type: BXClient.ORDER_TYPE, * REQUIRED
      amount: float, * REQUIRED
      rate: float, * REQUIRED
    }
  */
  createOrder (params) {
    validator('pairing', params, 'pairing', true)
    validator('type', params, 'order_type', true)
    validator('amount', params, 'number', true)
    validator('rate', params, 'number', true)
    return this.__privateAPICaller('api/order/', params)
  }

  /* Cancel order
    params : {
      pairing: integer, * REQUIRED
      order_id: number, * REQUIRED
    }
  */
  cancelOrder (params) {
    validator('pairing', params, 'pairing', true)
    validator('order_id', params, 'order_id', true)
    return this.__privateAPICaller('api/cancel/', params)
  }

  /* Get balances
    params : { }
  */
  getBalance () {
    return this.__privateAPICaller('api/balance/')
  }

  /* Get Orders
    params : {
      pairing: integer, OPTIONAL
      type: BXClient.ORDER_TYPE, OPTIONAL
    }
  */
  getOrders (params) {
    params = params || {}
    validator('pairing', params, 'pairing')
    validator('type', params, 'order_type')
    return this.__privateAPICaller('api/getorders', params)
  }

  /* Get transaction history
    params : {
      currency: integer, OPTIONAL
      type: BXClient.TRANSACTION_TYPE, OPTIONAL
      start_date: date, OPTIONAL
      end_date: date, OPTIONAL
    }
  */
  getTransactionHistory (params) {
    params = params || {}
    validator('start_date', params, 'date')
    validator('end_date', params, 'date')
    validator('type', params, 'transaction_type')
    validator('currency', params, 'string')
    return this.__privateAPICaller('api/history', params)
  }

  /* Get deposit address
    params : {
      currency: integer, * REQUIRED
      new: boolean, OPTIONAL
    }
  */
  getDepositAddress (params) {
    validator('currency', params, 'string', true)
    return this.__privateAPICaller('api/deposit', params)
  }

  /* Request for withdrawal
    params : {
      currency: string, * REQUIRED
      amount: number, OPTIONAL
      address: string, OPTIONAL
      bank_id: string, OPTIONAL
    }
  */
  requestForWithdrawal(params) {
    validator('currency', params, 'string', true)
    validator('amount', params, 'number', true)
    validator('address', params, 'string')
    validator('bank_id', params, 'string')
    return this.__privateAPICaller('api/withdrawal', params)
  }

  /* Get withdrawal history
    params : {}
  */
  getWidrawalHistory () {
    return this.__privateAPICaller('api/withdrawal-history')
  }

  /* Get bill payment types/groups
    params : {}
  */
  getBillPaymentGroup () {
    return this.__privateAPICaller('api/billgroup')
  }

  /* Get bill payment provider
    params : {
      group_id: integer, * REQUIRED
    }
  */
  getBillPaymentProvider (params) {
    validator('group_id', params, 'number', true)
    return this.__privateAPICaller('api/biller')
  }


  /* Create bill payment
    params : {
      biller: integer, * REQUIRED
      amount: float, * REQUIRED
      account: string, * REQUIRED
    }
  */
  createBillPayment (params) {
    validator('biller', params, 'number', true)
    validator('amount', params, 'number', true)
    validator('account', params, 'string', true)
    return this.__privateAPICaller('api/billpay')
  }
}

// Static constants
BXClient.ORDER_TYPE = ORDER_TYPE
BXClient.TRANSACTION_TYPE = TRANSACTION_TYPE

module.exports = BXClient
