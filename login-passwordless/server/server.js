const http = require('http');
const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();


const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const base64url = require('base64url');

const rpID = "localhost";
const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
app.use(cors({ origin: ['http://localhost:3000'],}));
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//DATABASE
const userSchema = new mongoose.Schema({
    email: { type: String, required: true },
    userId: { type: String, required: true },
    currentChallenge: String,
    credentials: [
        {
        credentialID: String,
        publicKey: String,
        counter: Number
        }
    ]
});
const User = mongoose.model('User', userSchema);

mongoose.connect('mongodb://localhost:27017/login-passwordless', { });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Errore di connessione:'));
db.once('open', () => {
    console.log('Connessione al database riuscita!');
});

//FUNZIONI CHE GESTISCONO LA REGISTRAZIONE
function toBase64url(obj) {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (value instanceof Buffer) {
      return base64url.encode(value);
    }
    return value;
  }));
}

app.post('/generate-registration-options', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    console.log("Email mancante");
    return res.status(400).json({ error: 'Email mancante' });
  }

  let user = await User.findOne({ email: email });

  if (!user) {
    const newUserId = crypto.randomUUID();
    const options = generateRegistrationOptions({
      rpName: 'Login-Passwordless',
      rpID: rpID,
      userID: newUserId,
      userName: email,
      timeout: 60000,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: [],
    });
    user = new User({
      email: email,
      userId: newUserId,
      currentChallenge: options.challenge,
      credentials: []
    });
    await user.save();

    return res.json(options);
  }

  const excludeCredentials = user.credentials.map(cred => ({
    id: Buffer.from(cred.credentialID, 'base64url'),
    type: 'public-key',
  }));

  const options = generateRegistrationOptions({
    rpName: 'Login-Passwordless',
    rpID: rpID,
    userID: user.userId,
    userName: user.email,
    timeout: 60000,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    excludeCredentials,
  });
  user.currentChallenge = options.challenge;
  await user.save();

  res.json(toBase64url(options));

});

//VERIFY REGISTRATION
app.post('/verify-registration', async (req, res) => {
  const { email, credential } = req.body;

  let user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ error: 'Utente non trovato' });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: 'http://localhost:3000',
      expectedRPID: rpID,
    });

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credentialPublicKey, credentialID, counter } = registrationInfo;

      user.credentials.push({
        credentialID: Buffer.from(credentialID).toString('base64url'),
        publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
        counter,
      });
      user.currentChallenge = '';
      await user.save();

      return res.status(200).json({ success: true });
    }

    res.status(400).json({ success: false, error: 'Verifica fallita' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante la verifica' });
  }
});

 
//FUNZIONI PER LOGIN
app.post('/generate-authentication-options', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email mancante" });

  const user = await User.findOne({ email: email });
  if (!user || user.credentials.length === 0) {
    return res.status(404).json({ message: "Utente non registrato" });
  }

  const options = generateAuthenticationOptions({
    allowCredentials: user.credentials.map(cred => ({
      id: Buffer.from(cred.credentialID, 'base64url'),
      type: 'public-key',
    })),
    userVerification: 'preferred',
    timeout: 60000,
    rpID,
  });

  user.currentChallenge = options.challenge;
  await user.save();

  return res.json(options);
});

app.post('/verify-authentication', async (req, res) => {
  const { email, credential } = req.body;

  const user = await User.findOne({ email: email });

  if (!user) return res.status(400).json({ message: "Utente non trovato" });

  const expectedChallenge = user.currentChallenge;
  const dbCred = user.credentials.find(c => c.credentialID === credential.id);

  if (!dbCred) return res.status(400).json({ message: "Credenziale non trovata" });

  try {
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: `http://localhost:3000`,
      expectedRPID: rpID,
      authenticator: {
        counter: dbCred.counter,
        credentialPublicKey: Buffer.from(dbCred.publicKey, 'base64url'),
        credentialID: Buffer.from(dbCred.credentialID, 'base64url'),
      }
    });

    if (verification.verified) {
      dbCred.counter = verification.authenticationInfo.newCounter;
      user.currentChallenge = '';
      await user.save();
    }

    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    return res.json({ verified: true, token });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Errore nella verifica" });
  }
});


const PORT = process.env.PORT || 3001;
http.createServer(app).listen(PORT, () => {
    console.log(`Server HTTP avviato sulla porta ${PORT}`);
});
