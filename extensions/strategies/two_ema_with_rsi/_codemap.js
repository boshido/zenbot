module.exports = {
  _ns: 'zenbot',

  'strategies.two_ema_with_rsi': require('./strategy'),
  'strategies.list[]': '#strategies.two_ema_with_rsi'
}
