const express = require('express');
const https = require('https');
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

const RCON_HOST = '65.21.24.203';
const RCON_PORT = 25727;
const RCON_PASS = 'gCVELd59Gz';

const CRYSTAL_LOGIN = 'migoy34';
const CRYSTAL_SECRET = '0e300c433cdccd75fdaf8ad330767eddfbea5b43';
const CRYSTAL_SALT = '25e67b70b62eea85a2cb6b472acf2c87fc12dff0';
const CALLBACK_URL = 'https://hazaomirixgithubio-production.up.railway.app/crystal-webhook';
const SITE_URL = 'https://hazaomirix.github.io';

const RANKS = {
  'Knight':     { amount: '199',  cmds: ['lp user %nick% parent set knight', 'say Игрок %nick% получил ранг Knight!'] },
  'Hero':       { amount: '349',  cmds: ['lp user %nick% parent set hero', 'say Игрок %nick% получил ранг Hero!'] },
  'Duke':       { amount: '499',  cmds: ['lp user %nick% parent set duke', 'say Игрок %nick% получил ранг Duke!'] },
  'Baron':      { amount: '699',  cmds: ['lp user %nick% parent set baron', 'say Игрок %nick% получил ранг Baron!'] },
  'Prince':     { amount: '999',  cmds: ['lp user %nick% parent set prince', 'say Игрок %nick% получил ранг Prince!'] },
  'King':       { amount: '1499', cmds: ['lp user %nick% parent set king', 'say Игрок %nick% получил ранг King!'] },
  'Emperor':    { amount: '2499', cmds: ['lp user %nick% parent set emperor', 'say Игрок %nick% получил ранг Emperor!'] },
  'Legend':     { amount: '4999', cmds: ['lp user %nick% parent set legend', 'say Игрок %nick% получил ранг Legend!'] },
  'Overlord':   { amount: '9999', cmds: ['lp user %nick% parent set overlord', 'say Игрок %nick% получил ранг Overlord!'] },
  'Разбан':     { amount: '199',  cmds: ['unban %nick%', 'say Игрок %nick% разбанен!'] },
  'Размут':     { amount: '99',   cmds: ['unmute %nick%', 'say Игрок %nick% размучен!'] },
  'Донат-кейс': { amount: '50',   cmds: ['give %nick% chest 1', 'say Игрок %nick% получил донат-кейс!'] },
};

async function sendRcon(cmd) {
  const client = new Rcon({ host: RCON_HOST, port: RCON_PORT, password: RCON_PASS, timeout: 8000 });
  await client.connect();
  const result = await client.send(cmd);
  await client.end();
  return result;
}

function apiPost(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const opts = {
      hostname: 'api.crystalpay.io',
      path: '/v3/' + path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(opts, (res) => {
      let r = '';
      res.on('data', (chunk) => r += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(r)); } catch(e) { reject(new Error(r)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

app.get('/', (req, res) => res.json({ status: 'ok', server: 'MCubic' }));

app.get('/create-payment', async (req, res) => {
  const nick = req.query.nick, rank = req.query.rank;
  if (!nick || !rank || !RANKS[rank]) return res.status(400).json({ success: false, error: 'bad params' });
  try {
    const result = await apiPost('invoice/create/', {
      auth_login: CRYSTAL_LOGIN,
      auth_secret: CRYSTAL_SECRET,
      amount: RANKS[rank].amount,
      type: 'purchase',
      lifetime: 30,
      description: 'MCubic ' + rank,
      extra: nick + ':' + rank,
      redirect_url: SITE_URL,
      callback_url: CALLBACK_URL
    });
    if (result.error || !result.url) {
      throw new Error(JSON.stringify(result.errors || result));
    }
    res.json({ success: true, url: result.url, id: result.id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/crystal-webhook', async (req, res) => {
  const body = req.body;
  if (!body || body.status !== 'paid') return res.json({ error: 'not paid' });
  const extra = body.extra || '';
  const parts = extra.split(':');
  if (parts.length !== 2) return res.json({ error: 'bad extra' });
  const nick = parts[0], rank = parts[1];
  if (!nick || !rank || !RANKS[rank]) return res.json({ error: 'no rank' });
  try {
    const results = [];
    for (const cmd of RANKS[rank].cmds) results.push(await sendRcon(cmd.replace(/%nick%/g, nick)));
    console.log('GRANTED ' + rank + ' to ' + nick);
    res.json({ status: 'success' });
  } catch (e) {
    res.json({ status: 'error', message: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('MCubic server on port ' + PORT));