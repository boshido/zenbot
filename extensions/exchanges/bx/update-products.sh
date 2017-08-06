#!/usr/bin/env node

var BXClient = require('./caller')
var bx = new BXClient()

var mapping
var products = []

function addProduct(asset, currency, id) {
  products.push({
    id: id,
    asset: asset,
    currency: currency,
    min_size: '0.01',
    increment: '0.00000001',
    label: asset + '/' + currency
  })
}



bx.getParing()
.then(function (data) {
  if (!data.success) {
    console.log(data)
    process.exit(1)
  }
  Object.keys(data.pairing).forEach(function (id) {
    addProduct(data.pairing[id].secondary_currency, data.pairing[id].primary_currency, id)
  })
  var target = require('path').resolve(__dirname, 'products.json')
  require('fs').writeFileSync(target, JSON.stringify(products, null, 2))
  console.log('wrote', target)
  process.exit()
})
