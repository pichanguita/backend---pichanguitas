const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');

const LOGO_PATH = path.join(__dirname, '..', 'templates', 'logo.png');

let resendClient = null;

const getClient = () => {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('RESEND_API_KEY no configurada. El envio de emails no funcionara.');
      return null;
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
};

/**
 * Envia un email con el logo incrustado via Resend API (HTTPS)
 * @param {Object} options - { to, subject, html }
 */
const sendEmail = async ({ to, subject, html }) => {
  const client = getClient();
  if (!client) {
    throw new Error('El servicio de email no esta configurado. Configura RESEND_API_KEY en las variables de entorno.');
  }

  const from = process.env.RESEND_FROM;
  if (!from) {
    throw new Error('RESEND_FROM no configurada. Configura el remitente en las variables de entorno.');
  }

  const logoBase64 = fs.readFileSync(LOGO_PATH).toString('base64');

  const { data, error } = await client.emails.send({
    from,
    to: [to],
    subject,
    html,
    attachments: [
      {
        content: logoBase64,
        filename: 'logo.png',
        contentId: 'pichanguita-logo',
      },
    ],
  });

  if (error) {
    throw new Error(`Error al enviar email: ${error.message}`);
  }

  console.log('Email enviado:', data.id);
  return data;
};

module.exports = { sendEmail };
