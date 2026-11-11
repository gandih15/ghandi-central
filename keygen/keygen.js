#!/usr/bin/env node
// أداة توليد مفاتيح التفعيل — للمطور فقط (م. محمد علي)
// الاستخدام:
//   node keygen.js                       (وضع تفاعلي بالأسئلة)
//   node keygen.js <البصمة> <الأيام> "<اسم المحل>"   (0 أيام = مدى الحياة)
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { signLicense, verifyLicense } = require('../lib/license-core');

const keyPath = process.env.GHANDI_KEY || path.join(__dirname, 'private_key.pem');
if (!fs.existsSync(keyPath)) { console.error('المفتاح الخاص مش موجود: ' + keyPath + '\nحط ملف private_key.pem جنب keygen.js (محفوظ عندك بس)'); process.exit(1); }
const priv = fs.readFileSync(keyPath, 'utf8');
const logFile = path.join(__dirname, 'licenses-log.csv');

function make(fp, days, shop) {
  const { key, data } = signLicense(priv, { fp, days, shop });
  const check = verifyLicense(key, data.fp);
  console.log('\n================= مفتاح التفعيل =================');
  console.log(key);
  console.log('=================================================');
  console.log('المحل:', shop || '-', '| البصمة:', data.fp, '| ينتهي:', data.exp === 'LIFE' ? 'مدى الحياة' : data.exp, '| فحص:', check.ok ? 'سليم ✔' : check.reason);
  if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, '﻿التاريخ,المحل,البصمة,الانتهاء,المفتاح\n');
  fs.appendFileSync(logFile, `${data.iat},"${shop || ''}",${data.fp},${data.exp},${key}\n`);
  console.log('تم الحفظ في سجل التراخيص: keygen/licenses-log.csv\n');
}

const a = process.argv.slice(2);
if (a.length >= 1) {
  make(a[0], a[1] || 0, a[2] || '');
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('بصمة الجهاز: ', fp => rl.question('عدد الأيام (0 = مدى الحياة): ', d => rl.question('اسم المحل: ', s => { make(fp, d, s); rl.close(); })));
}
