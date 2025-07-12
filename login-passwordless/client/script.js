const form = document.getElementById('form');
const errorMessage = document.getElementById('errorMessage');
const serverHTTP = "http://localhost:3001";

const email = localStorage.getItem('email');
if(email) {
  document.getElementById('email').value = email;
}

form.addEventListener('submit', function(event) {
  event.preventDefault();
  startRegistration();
});

function base64urlToBuffer(base64urlString) {
  const padding = '='.repeat((4 - base64urlString.length % 4) % 4);
  const base64 = (base64urlString + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

async function startRegistration() {
  try {
    const email = document.getElementById('email').value;
    const otp = document.getElementById('otp').value;

    const r = await fetch(`${serverHTTP}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        otp: otp,
      })
    });

    if (! r.ok) {
      const errData = await r.json();
      document.getElementById('message').innerText = errData.error || 'Errore sconosciuto.';
    }
    else {
      const optionsFromServer = await fetch(`${serverHTTP}/generate-registration-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      }).then(res => res.json());

      optionsFromServer.challenge = base64urlToBuffer(optionsFromServer.challenge);
      optionsFromServer.user.id = base64urlToBuffer(optionsFromServer.user.id);

      if (optionsFromServer.excludeCredentials) {
        optionsFromServer.excludeCredentials = optionsFromServer.excludeCredentials.map(cred => ({
          ...cred,
          id: base64urlToBuffer(cred.id)
        }));
      }

      const cred = await navigator.credentials.create({
        publicKey: optionsFromServer
      });

      const response = await fetch(`${serverHTTP}/verify-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          credential: cred
        })
      });

      if (response.ok) {
        document.getElementById('message').innerText = 'Registrazione completata!';
      } else {
        document.getElementById('message').innerText = 'Errore durante la registrazione.';
      }
    }

  } catch (err) {
    console.error(err);
    document.getElementById('message').innerText = '⚠️ Errore: ' + err.message;
  }
}
