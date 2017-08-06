module.exports = {
  _ns: 'zenbot',

  'exchanges.bx': require('./exchange'),
  'exchanges.list[]': '#exchanges.bx'
}
