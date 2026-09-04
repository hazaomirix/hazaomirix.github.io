const express = require('express');
const crypto = require('crypto');
const { Rcon } = require('rcon-client');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const RCON_HOST = process.env.RCON_HOST || '65.21.24.203';
const RCON_PORT = parseInt(process.env.RCON_PORT || '25727');
const RCON_PASS = process.env.RCON_PASS || 'gCVELd59Gz';

const CRYSTAL_MERCHANT = process.env.CRYSTAL_MERCHANT || 'migoy34';
const CRYSTAL_SECRET = process.env.CRYSTAL_SECRET || '0e300c433cdccd75fdaf8ad330767eddfbea5b43';
const CRYSTAL_SALT = process.env.CRYSTAL_SALT || '25e67b70b62eea85a2cb6b472acf2c87fc12dff0';
const ADMIN_KEY = process.env.ADMIN_KEY || 'mcubic2026';
const SITE_URL = 'https://hazaomirix.github.io';

const RANKS = {
  'Knight':     { amount: 199,   cmds: ['lp user %nick% parent set knight', 'say Игрок %nick% получил ранг Knight!'] },
  'Hero':       { amount: 349,   cmds: ['lp user %nick% parent set hero', 'say Игрок %nick% получил ранг Hero!'] },
  'Duke':       { amount: 499,   cmds: ['lp user %nick% parent set duke', 'say Игрок %nick% получил ранг Duke!'] },
  'Baron':      { amount: 699,   cmds: ['lp user %nick% parent set baron', 'say Игрок %nick% получил ранг Baron!'] },
  'Prince':     { amount: 999,   cmds: ['lp user %nick% parent set prince', 'say Игрок %nick% получил ранг Prince!'] },
  'King':       { amount: 1499,  cmds: ['lp user %nick% parent set king', 'say Игрок %nick% получил ранг King!'] },
  'Emperor':    { amount: 2499,  cmds: ['lp user %nick% parent set emperor', 'say Игрок %nick% получил ранг Emperor!'] },
  'Legend':     { amount: 4999,  cmds: ['lp user %nick% parent set legend', 'say Игрок %nick% получил ранг Legend!'] },
  'Overlord':   { amount: 9999,  cmds: ['lp user %nick% parent set overlord', 'say Игрок %nick% получил ранг Overlord!'] },
  'Разбан':     { amount: 199,   cmds: ['unban %nick%', 'say Игрок %nick% разбанен!'] },
  'Размут':     { amount: 99,    cmds: ['unmute %nick%', 'say Игрок %nick% размучен!'] },
  'Донат-кейс': { amount: 50,    cmds: ['give %nick% chest 1', 'say Игрок %nick% получил донат-кейс!'] },
};

const invoices = {};

async function sendRcon(cmd) {
  const client = new Rcon({ host: RCON_HOST, port: RCON_PORT, password: RCON_PASS, timeout: 8000 });
  await client.connect();
  const result = await client.send(cmd);
  await client.end();
  return result;
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', server: 'MCubic', merchant_set: !!CRYSTAL_MERCHANT });
});

app.get('/grant', async (req, res) => {
  const nick = req.query.nick;
  const rank = req.query.rank;
  const key = req.query.admin;
  if (key !== ADMIN_KEY) return res.status(403).json({ success: false, error: 'forbidden' });
  if (!nick || !rank || !RANKS[rank]) return res.status(400).json({ success: false, error: 'bad params' });
  try {
    const results = [];
    for (const cmd of RANKS[rank].cmds) results.push(await sendRcon(cmd.replace(/%nick%/g, nick)));
    res.json({ success: true, message: `${rank} выдан ${nick}`, results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/create-payment', (req, res) => {
  const nick = req.query.nick;
  const rank = req.query.rank;
  if (!nick || !rank || !RANKS[rank]) return res.status(400).json({ success: false, error: 'Укажи ник и ранг' });
  const amount = RANKS[rank].amount;
  const url = `https://crystalpay.io/merchant/pay?merchant=${CRYSTAL_MERCHANT}&amount=${amount}&currency=rub&description=MCubic+${encodeURIComponent(rank)}&custom_nick=${encodeURIComponent(nick)}&custom_rank=${encodeURIComponent(rank)}&redirect_url=${encodeURIComponent(SITE_URL)}`;
  res.json({ success: true, url: url });
});

app.post('/crystal-webhook', async (req, res) => {
  const body = req.body;
  console.log('WEBHOOK:', JSON.stringify(body));
  const id = body.id || body.invoice_id;
  if (body.status !== 'success') return res.json({ status: 'error', message: 'not success' });

  let nick = body.custom && (body.custom.nick || body.custom_rank);
  let rank = body.custom && (body.custom.rank || body.custom_rank);
  if ((!nick || !rank) && invoices[id]) {
    nick = invoices[id].nick;
    rank = invoices[id].rank;
  }
  if (!nick || !rank || !RANKS[rank]) {
    return res.json({ status: 'error', message: 'no nick/rank' });
  }
  const cmds = [];
  for (const c of RANKS[rank].cmds) cmds.push(await sendRcon(c.replace(/%nick%/g, nick)));
  console.log('GRANTED', rank, nick);
  res.json({ status: 'success' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('MCubic RCON+Pay server running on port ' + PORT);
  console.log('Merchant set: ' + !!CRYSTAL_MERCHANT);
});