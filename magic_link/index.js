const express = require('express');
const crypto = require('crypto');
const { sendMagicLink } = require('./emailService');
const mongoose = require('mongoose');

const app = express();
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = 3000;

//DATABASE
const tokenSchema = new mongoose.Schema({
    hashToken: { type: String, required: true },
    email: { type: String, required: true },
    expires: { type: Date, required: true },
});
const Token = mongoose.model('Token', tokenSchema);

mongoose.connect('mongodb://localhost:27017/login-passwordless', { });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Errore di connessione:'));
db.once('open', () => {
    console.log('Connessione al database riuscita!');
});

//Funzione che crea l'hash del token
function tokenToHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}



// Login form
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Login Passwordless</title>
      <link rel="stylesheet" href="/style.css" />
    </head>
    <body>
      <div class="container">
        <div class="card">
          <h1 class="title">🔐 Login Passwordless</h1>
          <p class="subtitle">Inserisci la tua email per ricevere il link di accesso</p>
          <form method="POST" action="/login" class="form">
            <label class="label" for="email">Email</label>
            <input class="input" type="email" id="email" name="email" required />
            <button class="button" type="submit">Invia link di accesso</button>
          </form>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Richiesta login
app.post('/login', async (req, res) => {
  const email = req.body.email;

  if (!email) {
    return res.status(400).send('Email mancante');
  }

  const token = crypto.randomBytes(32).toString('hex');

  try {
    const hash = tokenToHash(token);
    await Token.deleteOne({ hashToken: hash });
    await Token.deleteMany({ email: email });

    const newToken = new Token({ email: email, hashToken: hash, expires: new Date(Date.now() + 5 * 60 * 1000) }); // 5 minuti di validità
    await newToken.save();
  } catch (error) {
    console.error('Errore nel salvataggio del token: ', error);
  }

  const magicLink = `http://localhost:${PORT}/auth/${token}`;
  sendMagicLink(email, magicLink);

  res.send(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Controlla la tua email</title>
      <link rel="stylesheet" href="/style.css" />
    </head>
    <body>
      <div class="container">
        <div class="card">
          <h1 class="title">📧 Link inviato</h1>
          <p class="subtitle">Controlla la tua email <strong>${email}</strong> per accedere.</p>
          <a href="/" class="button" style="text-align:center;display:block;text-decoration:none;">Torna al login</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Autenticazione tramite link magico
app.get('/auth/:token', async (req, res) => {
  const token = req.params.token;
  const hash = tokenToHash(token);

  try {
    const tokens = await Token.find({ hashToken: hash }).sort({ expires: -1 });

    if (tokens.length === 0) {
      return res.status(401).send(`
        <!DOCTYPE html>
        <html lang="it">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Errore - Token non valido</title>
          <link rel="stylesheet" href="/style.css" />
        </head>
        <body>
          <div class="container">
            <div class="card">
              <h1 class="title error">Token non valido o scaduto</h1>
              <a href="/" class="button" style="text-align:center;display:block;text-decoration:none;">Torna al login</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }

    const record = tokens[0];
    await Token.deleteOne({ hashToken: hash });

    if (Date.now() >= record.expires) {
      return res.status(401).send(`
        <!DOCTYPE html>
        <html lang="it">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Errore - Token scaduto</title>
          <link rel="stylesheet" href="/style.css" />
        </head>
        <body>
          <div class="container">
            <div class="card">
              <h1 class="title error">Token scaduto</h1>
              <a href="/" class="button" style="text-align:center;display:block;text-decoration:none;">Torna al login</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Autenticato</title>
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>
        <div class="container">
          <div class="card">
            <h1 class="title">Benvenuto ${record.email}!</h1>
            <p class="subtitle">Sei autenticato.</p>
            <a href="/" class="button" style="text-align:center;display:block;text-decoration:none;">Logout</a>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Errore durante l\'autenticazione:', err);
    res.status(500).send('Errore interno del server');
  }
});


app.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
});
