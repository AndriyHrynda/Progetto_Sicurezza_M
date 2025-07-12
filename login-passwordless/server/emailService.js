const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL?.trim(),
    pass: process.env.PASS?.trim()
  }
});


function sendOTP(email, otp) {
    console.log(`Inviato a ${email}: ${otp}`);

    const mailOptions = {
        from: `"Richiesta di registrazione" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Il tuo codice OTP per registrarti',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5; padding: 20px;">
                <h2>Il tuo codice OTP</h2>
                <p>Ciao,</p>
                <p>E' stata effettuata una richiesta di registrazione con la tua e-mail. Inserisci questo codice nel sito per confermare:</p>
                <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; margin: 20px 0;">${otp}</p>
                <p>Il codice è valido per 5 minuti.</p>
                <hr />
                <p style="font-size: 0.8em; color: #888;">Se non hai richiesto questa registrazione, puoi ignorare questo messaggio.</p>
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

module.exports = { sendOTP };