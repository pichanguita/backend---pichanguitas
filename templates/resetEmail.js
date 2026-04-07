/**
 * Template HTML para el email de recuperacion de contrasena
 * Usa la linea grafica oficial de Pichanguita:
 *   - Teal oscuro (#1a3a3a) header/footer
 *   - Verde primary (#22c55e / #16a34a) CTA
 *   - Amarillo accent (#ffd500) highlights
 *   - Logo incrustado via CID (Content-ID) para compatibilidad con todos los clientes de email
 *
 * @param {string} userName - Nombre del usuario
 * @param {string} resetUrl - URL completa con el token
 * @returns {string} HTML del email
 */
const resetPasswordTemplate = (userName, resetUrl) => {
  const logoUrl = 'cid:pichanguita-logo';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperar contrasena - Pichanguita</title>
  <!--[if mso]>
  <style>
    table { border-collapse: collapse; }
    .button-link { padding: 14px 48px !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #e6eded; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #e6eded; padding: 32px 16px;">
    <tr>
      <td align="center">

        <!-- Main card -->
        <table role="presentation" width="580" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; width: 100%; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 30px rgba(26, 58, 58, 0.12);">

          <!-- ============ HEADER ============ -->
          <tr>
            <td style="background-color: #1a3a3a; padding: 0;">
              <!-- Top accent bar -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="height: 4px; background: linear-gradient(90deg, #22c55e, #ffd500, #22c55e); font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Logo + Brand -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding: 32px 40px 28px;">
                    <!-- Logo con fondo blanco -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" style="background-color: #ffffff; border-radius: 20px; padding: 16px 24px; margin-bottom: 16px;">
                          <img src="${logoUrl}" alt="Pichanguita" width="120" height="120" style="display: block; width: 120px; height: 120px; object-fit: contain;" />
                        </td>
                      </tr>
                    </table>
                    <!-- Espacio -->
                    <div style="height: 16px; font-size: 0; line-height: 0;">&nbsp;</div>
                    <!-- Brand name -->
                    <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 3px; text-transform: uppercase; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">PICHANGUITA</h1>
                    <p style="margin: 6px 0 0; font-size: 11px; color: #22c55e; letter-spacing: 4px; text-transform: uppercase; font-weight: 600;">Reserva de Cancha</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============ GREEN DIVIDER ============ -->
          <tr>
            <td style="height: 5px; background: linear-gradient(135deg, #22c55e, #16a34a); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- ============ BODY ============ -->
          <tr>
            <td style="padding: 40px 40px 16px;">

              <!-- Greeting -->
              <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #1a3a3a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                Hola, ${userName}
              </h2>
              <p style="margin: 0 0 28px; font-size: 15px; line-height: 1.7; color: #475569;">
                Recibimos una solicitud para restablecer la contrase&ntilde;a de tu cuenta en <strong style="color: #1a3a3a;">Pichanguita</strong>. Haz clic en el bot&oacute;n de abajo para crear tu nueva contrase&ntilde;a.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding: 4px 0 32px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" style="border-radius: 12px; background: linear-gradient(135deg, #22c55e, #16a34a); box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);">
                          <a href="${resetUrl}" target="_blank" class="button-link" style="display: inline-block; padding: 16px 52px; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; letter-spacing: 0.5px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                            Restablecer contrase&ntilde;a
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security notice -->
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #64748b;">
                Si t&uacute; no solicitaste este cambio, puedes ignorar este correo con total tranquilidad. Tu contrase&ntilde;a actual no ser&aacute; modificada.
              </p>

              <!-- Expiration warning -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background-color: #fffbeb; border-left: 4px solid #ffd500; padding: 14px 18px; border-radius: 0 10px 10px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding-right: 10px; vertical-align: top; font-size: 18px;">&#9201;</td>
                        <td>
                          <p style="margin: 0; font-size: 13px; color: #854d0e; line-height: 1.5;">
                            <strong>Este enlace expira en 1 hora.</strong><br>
                            Despu&eacute;s de ese tiempo, tendr&aacute;s que solicitar uno nuevo.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ============ FALLBACK LINK ============ -->
          <tr>
            <td style="padding: 0 40px 36px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-top: 1px dashed #cbd5e1; padding-top: 20px;">
                    <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                      Si el bot&oacute;n no funciona, copia y pega este enlace en tu navegador:
                    </p>
                    <p style="margin: 6px 0 0;">
                      <a href="${resetUrl}" style="font-size: 12px; color: #22c55e; word-break: break-all; text-decoration: underline;">${resetUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============ FOOTER ============ -->
          <tr>
            <td style="background-color: #1a3a3a; padding: 28px 40px; text-align: center;">
              <!-- Footer divider -->
              <table role="presentation" width="60" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 16px;">
                <tr>
                  <td style="height: 3px; background-color: #22c55e; border-radius: 2px; font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
              </table>

              <p style="margin: 0 0 6px; font-size: 12px; color: #80a6a6; line-height: 1.5;">
                Este es un correo autom&aacute;tico de <strong style="color: #22c55e;">Pichanguita</strong>.
              </p>
              <p style="margin: 0 0 12px; font-size: 12px; color: #80a6a6;">
                Por favor, no respondas a este mensaje.
              </p>
              <p style="margin: 0; font-size: 11px; color: #4d8282;">
                &copy; ${new Date().getFullYear()} Pichanguita &mdash; Reserva de Cancha
              </p>
            </td>
          </tr>

          <!-- Bottom accent bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #22c55e, #ffd500, #22c55e); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

        </table>

        <!-- Sub-footer tip -->
        <table role="presentation" width="580" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; width: 100%;">
          <tr>
            <td align="center" style="padding: 20px 40px 0;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                Si tienes problemas, cont&aacute;ctanos por WhatsApp o visita nuestra p&aacute;gina.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
};

module.exports = { resetPasswordTemplate };
