const express = require('express');
const crypto = require('crypto');
const { Rcon } = require('rcon-client');

const app = express();
app.use(express.json());

// CORS — разрешаем запросы с GitHub Pages
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Главная — проверка что сервер жив
app.get('/', (req, res) => {
  res.json({ status: 'ok', server: 'MCubic RCON' });
});

// НАСТРОЙКИ
const RCON_HOST = '65.21.24.203';
const RCON_PORT = 25727;
const RCON_PASS = 'gCVELd59Gz';

// ТВОЙ CRYSTALPAY SALT (получить в кабинете CrystalPay → Настройки → Соль)
const CRYSTAL_SALT = '7b18f1bc37a495c75354eb73e30c9df0fa6c82ff';

// ТВОЙ CRYSTALPAY MERCHANT ID
const MERCHANT_ID = ''; // напиши мне его

const COMMANDS = {
  'Knight': ['lp user %nick% parent set knight', 'say Игрок %nick% получил ранг Knight!'],
  'Hero': ['lp user %nick% parent set hero', 'say Игрок %nick% получил ранг Hero!'],
  'Duke': ['lp user %nick% parent set duke', 'say Игрок %nick% получил ранг Duke!'],
  'Baron': ['lp user %nick% parent set baron', 'say Игрок %nick% получил ранг Baron!'],
  'Prince': ['lp user %nick% parent set prince', 'say Игрок %nick% получил ранг Prince!'],
  'King': ['lp user %nick% parent set king', 'say Игрок %nick% получил ранг King!'],
  'Emperor': ['lp user %nick% parent set emperor', 'say Игрок %nick% получил ранг Emperor!'],
  'Legend': ['lp user %nick% parent set legend', 'say Игрок %nick% получил ранг Legend!'],
  'Overlord': ['lp user %nick% parent set overlord', 'say Игрок %nick% получил ранг Overlord!'],
  'Разбан': ['unban %nick%', 'say Игрок %nick% разбанен!'],
  'Размут': ['unmute %nick%', 'say Игрок %nick% размучен!'],
  'Донат-кейс': ['give %nick% chest 1', 'say Игрок %nick% получил донат-кейс!'],
};

async function sendRcon(cmd) {
  const client = new Rcon({ host: RCON_HOST, port: RCON_PORT, password: RCON_PASS });
  await client.connect();
  const result = await client.send(cmd);
  await client.end();
  return result;
}

// Проверка подписи CrystalPay
function verifyCrystal(data, signature) {
  const str = Object.keys(data).sort().map(k => data[k]).join('|') + CRYSTAL_SALT;
  const hash = crypto.createHash('sha256').update(str).digest('hex');
  return hash === signature;
}

// WEBHOOK от CrystalPay
app.post('/crystal-webhook', (req, res) => {
  const { signature, ...data } = req.body;
  
  // if (!verifyCrystal(data, signature)) {
  //   return res.status(403).json({ error: 'bad sign' });
  // }

  const nick = req.body.custom_nick; // передаём ник в custom поле
  const product = req.body.product_name;

  if (!nick || !product) {
    return res.json({ error: 'no nick/product', status: 'error' });
  }

  if (!COMMANDS[product]) {
    return res.json({ error: 'unknown product', status: 'error' });
  }

  const commands = COMMANDS[product].map(c => c.replace(/%nick%/g, nick));

  (async () => {
    try {
      for (const cmd of commands) {
        await sendRcon(cmd);
      }
      console.log(`✅ ${product} выдан ${nick}`);
      res.json({ status: 'success' });
    } catch (e) {
      console.error('RCON error:', e.message);
      res.json({ status: 'error', message: e.message });
    }
  })();
});

// Тестовая выдача (с сайта)
app.get('/grant', (req, res) => {
  const nick = req.query.nick;
  const rank = req.query.rank;
  
  if (!nick || !rank || !COMMANDS[rank]) {
    return res.status(400).json({ success: false, error: 'bad params' });
  }

  const commands = COMMANDS[rank].map(c => c.replace(/%nick%/g, nick));

  (async () => {
    try {
      const results = [];
      for (const cmd of commands) {
        results.push(await sendRcon(cmd));
      }
      res.json({ success: true, message: `${rank} выдан ${nick}`, results });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  })();
});

// GET ссылки на оплату
app.get('/pay', (req, res) => {
  const nick = req.query.nick;
  const rank = req.query.rank;
  const amount = req.query.amount;

  if (!nick || !rank || !amount) {
    return res.status(400).json({ error: 'Укажи ник, ранг и сумму' });
  }

  // Редирект на CrystalPay
  const url = `https://crystalpay.io/merchant/pay?merchant=${MERCHANT_ID}&amount=${amount}&currency=rub&custom_nick=${encodeURIComponent(nick)}&custom_rank=${encodeURIComponent(rank)}&description=MCubic+${encodeURIComponent(rank)}`;
  res.redirect(url);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCubic RCON Server running on port ${PORT}`);
  console.log(`RCON: ${RCON_HOST}:${RCON_PORT}`);
});