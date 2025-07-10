const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL?.trim(),
    pass: process.env.PASS?.trim()
  }
});


function sendMagicLink(email, link) {
    console.log(`Inviato a ${email}: ${link}`);

    const mailOptions = {
        from: `"Login Sicuro" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔐 Accedi con il tuo link di accesso',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5; padding: 20px;">
            <h2>🔑 Link di accesso</h2>
            <p>Ciao,</p>
            <p>Hai richiesto di accedere al tuo account. Clicca sul link qui sotto per autenticarti:</p>
            <p>
                <a href="${link}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px;">
                Accedi ora
                </a>
            </p>
            <p>Oppure copia e incolla questo link nel browser:</p>
            <p><code>${link}</code></p>
            <p style="color: gray; font-size: 0.9em;">Questo link è valido per 5 minuti.</p>
            <hr />
            <p style="font-size: 0.8em; color: #888;">Se non hai richiesto questo accesso, puoi ignorare questo messaggio.</p>
            </div>
        `
    };


    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
        console.error('Errore invio email:', error);
        } else {
        console.log('Email inviata:', info.response);
        }
    });
}

module.exports = { sendMagicLink };