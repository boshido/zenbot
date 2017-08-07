var z = require('zero-fill')
  , n = require('numbro')
var a = 0
module.exports = function container (get, set, clear) {
  return {
    name: 'two_ema_with_rsi',
    description: 'Buy when (FIRST_EMA > SECOND_EMA) and sell when (FIRST_EMA < SECOND_EMA). Optional buy on low RSI.',

    getOptions: function () {
      // this.option('period', 'period length', String, '2m')
      // this.option('min_periods', 'min. number of history periods', Number, 52)
      // this.option('trend_ema', 'number of periods for trend EMA', Number, 26)
      // this.option('neutral_rate', 'avoid trades if abs(trend_ema) under this float (0 to disable, "auto" for a variable filter)', Number, 'auto')
      // this.option('oversold_rsi_periods', 'number of periods for oversold RSI', Number, 14)
      // this.option('oversold_rsi', 'buy when RSI reaches this value', Number, 10)
      this.option('period', 'period length', String, '1h')
      this.option('min_periods', 'min. number of history periods', Number, 52)
      this.option('length_first_ema', 'length for first EMA', Number, 3)
      this.option('length_second_ema', 'length periods for second EMA', Number, 6)
      this.option('neutral_rate', 'avoid trades if abs(trend_ema) under this float (0 to disable, "auto" for a variable filter)', Number, 'auto')
      this.option('oversold_rsi_periods', 'number of periods for oversold RSI', Number, 9)
      this.option('oversold_rsi', 'buy when RSI reaches this value', Number, 10)
      this.option('accept_lose', 'buy when RSI reaches this value', Number, 10)
    },

    calculate: function (s) {
      // console.log(JSON.stringify(s))
      get('lib.ema')(s, 'first_trend_ema', s.options.length_first_ema)
      get('lib.ema')(s, 'second_trend_ema', s.options.length_second_ema)
      if (s.options.oversold_rsi) {
        // sync RSI display with oversold RSI periods
        s.options.rsi_periods = s.options.oversold_rsi_periods
        get('lib.rsi')(s, 'oversold_rsi', s.options.oversold_rsi_periods)
        if (!s.in_preroll && s.period.oversold_rsi <= s.options.oversold_rsi && !s.oversold && !s.cancel_down) {
          s.oversold = true
          if (s.options.mode !== 'sim' || s.options.verbose) console.log(('\noversold at ' + s.period.oversold_rsi + ' RSI, preparing to buy\n').cyan)
        }
      }
      // if (s.period.first_trend_ema && s.period.second_trend_ema) {
      //   throw new Error()
      // }

      if (s.period.first_trend_ema && s.lookback[0] && s.lookback[0].first_trend_ema) {
        s.period.first_trend_ema_rate = (s.period.first_trend_ema - s.lookback[0].first_trend_ema) / s.lookback[0].first_trend_ema * 100
      }
      if (s.period.second_trend_ema && s.lookback[0] && s.lookback[0].second_trend_ema) {
        s.period.second_trend_ema_rate = (s.period.second_trend_ema - s.lookback[0].second_trend_ema) / s.lookback[0].second_trend_ema * 100
      }

      if (s.options.neutral_rate === 'auto') {
        get('lib.stddev')(s, 'first_trend_ema_stddev', 10, 'first_trend_ema_rate')
        get('lib.stddev')(s, 'second_trend_ema_stddev', 10, 'second_trend_ema_rate')
      }
      else {
        s.period.first_trend_ema_stddev = s.options.neutral_rate
        s.period.second_trend_ema_stddev = s.options.neutral_rate
      }
    },

    onPeriod: function (s, cb) {
      if (!s.in_preroll && typeof s.period.oversold_rsi === 'number') {
        if (s.oversold) {
          s.oversold = false
          s.trend = 'oversold'
          s.signal = 'wait'
          s.cancel_down = true
          return cb()
        }
      }
      //console.log(s.period.first_trend_ema_stddev)
      // console.log(s.period.oversold_rsi)
      // console.log(s.period.first_trend_ema)
      // console.log(s.period.second_trend_ema)
      // console.log(s)
      if (typeof s.period.first_trend_ema === 'number' && typeof s.period.second_trend_ema === 'number') {
        if ((s.period.first_trend_ema > s.period.second_trend_ema ) && (s.period.oversold_rsi <= 60) ) { //
          if (s.trend !== 'up') {
            s.acted_on_trend = false
          }
          s.trend = 'up'
          s.signal = !s.acted_on_trend ? 'buy' : null
          s.cancel_down = false
        }
        else if (!s.cancel_down && (s.period.first_trend_ema < s.period.second_trend_ema ) && (s.period.second_trend_ema - s.period.first_trend_ema >= 0.25 )) { //(!s.cancel_down && s.period.first_trend_ema_rate < (s.period.first_trend_ema_stddev * -1))
          if (s.trend !== 'down') {
            s.acted_on_trend = false
          }
          s.trend = 'down'
          s.signal = !s.acted_on_trend ? 'sell' : null
        }
      }
      cb()
    },

    onReport: function (s) {
      var cols = []
      function reportRateAndStddev(rate, stddev) {
        var cols = []
        if (typeof stddev === 'number') {
          var color = 'grey'
          if (rate > stddev) {
            color = 'green'
          }
          else if (rate < (stddev * -1)) {
            color = 'red'
          }
          cols.push(z(8, n(rate).format('0.0000'), ' ')[color])
          if (stddev) {
            cols.push(z(8, n(stddev).format('0.0000'), ' ').grey)
          }
        }
        else {
          if (stddev) {
            cols.push('                  ')
          }
          else {
            cols.push('         ')
          }
        }
        return cols
      }

      cols = cols.concat(reportRateAndStddev(s.period.first_trend_ema_rate, s.period.first_trend_ema_stddev))
      cols = cols.concat(reportRateAndStddev(s.period.second_trend_ema_rate, s.period.second_trend_ema_stddev))

      if (typeof s.period.first_trend_ema_stddev === 'number' && typeof s.period.second_trend_ema_stddev === 'number') {
        if (s.period.first_trend_ema > s.period.second_trend_ema) {
          cols.push(z(6, 'UP', ' ').green)
        } else {
          cols.push(z(6, 'DOWN', ' ').red)
        }
      } else {
        cols.push('       ')
      }
      return cols
    }
  }
}
