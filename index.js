import fetch from 'node-fetch'; // لاستيراد fetch
import { Client } from 'binance-api-node'; // مكتبة Binance API
import TelegramBot from 'node-telegram-bot-api'; // مكتبة تلغرام API
import fs from 'fs'; // مكتبة قراءة الملفات

// جلب المتغيرات البيئية
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; // توكن تلغرام
const CHAT_ID = process.env.CHAT_ID; // معرف الدردشة
const BINANCE_API_KEY = process.env.BINANCE_API_KEY; // مفتاح API لبينانس
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET; // المفتاح السري لبينانس

// التأكد من وجود جميع المفاتيح المطلوبة
if (!TELEGRAM_TOKEN || !CHAT_ID || !BINANCE_API_KEY || !BINANCE_API_SECRET) {
  console.error('يرجى التأكد من إعداد جميع المتغيرات البيئية.');
  process.exit(1);
}

// إنشاء عميل Binance
const client = Client({
  apiKey: BINANCE_API_KEY,
  apiSecret: BINANCE_API_SECRET,
});

// إنشاء بوت تلغرام
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// قراءة أزواج التداول من ملف pairs.json
function readPairs() {
  try {
    const data = fs.readFileSync('pairs.json', 'utf-8');
    const pairs = JSON.parse(data).pairs;
    return pairs;
  } catch (error) {
    console.error('خطأ أثناء قراءة ملف pairs.json:', error.message);
    process.exit(1);
  }
}

// جلب بيانات السوق من CoinGecko
async function fetchMarketData(pair) {
  const url = `https://api.coingecko.com/api/v3/coins/${pair}/market_chart?vs_currency=usd&days=1`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`خطأ أثناء جلب بيانات السوق لـ ${pair}`);
  }
  const data = await response.json();
  return data;
}

// تحليل البيانات باستخدام مؤشرات RSI والسيولة
function analyzeMarket(data) {
  // حساب RSI هنا (كمثال فقط)
  const rsi = 30; // افترض أن RSI أقل من 30
  const volume = 1000000; // افترض حجم السيولة كبير

  if (rsi < 30 && volume > 1000000) return 'buy'; // توصية بالشراء
  if (rsi > 70) return 'sell'; // توصية بالبيع
  return 'hold'; // لا توجد توصية
}

// إرسال تنبيه عبر تلغرام
function sendTelegramAlert(message) {
  bot.sendMessage(CHAT_ID, message);
}

// تنفيذ الصفقات في Binance
async function executeTrade(pair, action, amount) {
  try {
    const price = await client.prices({ symbol: pair });
    const quantity = (amount / parseFloat(price[pair])).toFixed(6);

    if (action === 'buy') {
      const order = await client.order({
        symbol: pair,
        side: 'BUY',
        quantity,
        type: 'MARKET',
      });
      sendTelegramAlert(`تم شراء ${pair} بكمية ${quantity}`);
      return order;
    }

    if (action === 'sell') {
      const order = await client.order({
        symbol: pair,
        side: 'SELL',
        quantity,
        type: 'MARKET',
      });
      sendTelegramAlert(`تم بيع ${pair} بكمية ${quantity}`);
      return order;
    }
  } catch (error) {
    console.error(`خطأ أثناء تنفيذ صفقة ${action} لـ ${pair}:`, error.message);
    sendTelegramAlert(`خطأ أثناء تنفيذ صفقة ${action} لـ ${pair}: ${error.message}`);
  }
}

// مراقبة الأزواج والبحث عن الصفقات
async function monitorPairs() {
  const pairs = readPairs();
  for (const pair of pairs) {
    try {
      const marketData = await fetchMarketData(pair);
      const action = analyzeMarket(marketData);

      if (action === 'buy') {
        sendTelegramAlert(`فرصة شراء لـ ${pair}. اضغط على الزر للشراء.`);
        // هنا يمكنك إضافة أزرار تلغرام للشراء
      } else if (action === 'sell') {
        sendTelegramAlert(`فرصة بيع لـ ${pair}.`);
      }
    } catch (error) {
      console.error(`خطأ أثناء معالجة الزوج ${pair}:`, error.message);
    }
  }
}

// بدء المراقبة بشكل مستمر
setInterval(() => {
  monitorPairs();
}, 60000); // البحث عن الصفقات كل دقيقة
