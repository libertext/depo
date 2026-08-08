/* Mint a customer access token.  Usage:  node gen-token.js [customer-name]
 * Add the printed token to ACCESS_TOKENS (comma-separated) in your .env /
 * hosting env vars, then hand it to the customer. */
const crypto = require('crypto');
const name = (process.argv[2] || 'musteri').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20);
const token = `${name}-${crypto.randomBytes(6).toString('hex')}`;
console.log('\n  Yeni erişim jetonu:\n');
console.log('    ' + token + '\n');
console.log('  → Bunu .env içindeki ACCESS_TOKENS listesine ekle (virgülle ayır)');
console.log('  → Müşteriye ver, uygulamada ⚙️ Ayarlar\'a girsin.\n');
