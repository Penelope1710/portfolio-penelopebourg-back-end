const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
// destructuration: import uniquement de la fonction createServer
const { createServer } = require('node:http');

dotenv.config({
    path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env'
});

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;

const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 10000
});

async function verifyRecaptcha(token) {
    const verifyURL = 'https://www.google.com/recaptcha/api/siteverify';

    const params = new URLSearchParams();
    params.append('secret', RECAPTCHA_SECRET);
    params.append('response', token);

    try {
        const recaptchaRes = await fetch(verifyURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        if (!recaptchaRes.ok) {
            throw new Error(`Erreur réseau: ${recaptchaRes.status}`);
        }

        const result = await recaptchaRes.json();
        console.log('Résultat complet de Google :', result);
        return result;

    } catch (err) {
        console.error('Erreur lors de la vérification reCAPTCHA:', err);
        throw err;
    }
}

const server = createServer((req, res) => {

    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN);
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; script-src 'self' https://www.google.com https://www.gstatic.com; frame-src 'self' https://www.google.com https://www.gstatic.com;");
    
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/contact') {
        let body = '';
        req.on('data', chunk => {
            body+= chunk;
        });

        req.on('end', async () => {
            try {
                const { nom, email, message, recaptchaToken } = JSON.parse(body);
                if (!nom || !email || !message || !recaptchaToken) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ message: 'Tous les champs sont requis.' }));
                }

const recaptchaResult = await verifyRecaptcha(recaptchaToken);

console.log('Résultat complet reCAPTCHA:', recaptchaResult);

if (!recaptchaResult.success || recaptchaResult.score < 0.5) {
    console.warn('Échec reCAPTCHA :', recaptchaResult);
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Échec vérification reCAPTCHA.' }));
}


    const info = await transporter.sendMail({
        from: `"Contact Portfolio - Penelope Bourg" <${process.env.EMAIL_USER}>`,
        replyTo: email,
        to: process.env.EMAIL_USER,
        subject: 'Nouveau message via le Portfolio',
        text: `Vous avez reçu un nouveau message via votre portfolio\nNom: ${nom}\nEmail: ${email}\n\nMessage:\n${message}`,
    html: ` <h2>Vous avez reçu un nouveau message via votre portfolio</h2>
            <p><strong>Nom:</strong> ${nom}</p>
           <p><strong>Email:</strong> ${email}</p>
           <p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>
           <hr>
           <p>Ceci est un message automatique envoyé depuis le formulaire de contact du site.</p>
           <p>Portfolio de Penelope Bourg</p>`
    });

    console.log("Message envoyé : ", info.messageId);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Message envoyé avec succès !' }));
          

} catch (error) {
    console.error("Erreur lors de l'envoi :", error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Erreur serveur.' }));
        }
    });

    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Not Found');
    }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT,() => {
    console.log(`Serveur Node.js lancé sur http://localhost:${PORT}`);

});
