function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function buildWaitlistConfirmationEmailHtml(firstName: string) {
    const safeName = escapeHtml(firstName);

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<!--[if mso]>
<style type="text/css">
  table { border-collapse: collapse; }
  body, table, td, a { font-family: Arial, sans-serif !important; }
</style>
<![endif]-->
<style>
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; border-radius: 0 !important; }
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .hero-pt { padding-top: 28px !important; }
    .cta-pb { padding-bottom: 28px !important; }
    .h1 { font-size: 20px !important; }
    .btn { display: block !important; text-align: center !important; }
  }
</style>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f1f3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0f1f3;">
  <tr>
    <td align="center" style="padding: 48px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" class="container" style="max-width: 560px; width: 100%; background-color: #ffffff; border-radius: 14px; border: 1px solid #e5e7eb;">

        <!-- header -->
        <tr>
          <td class="px" style="padding: 28px 36px; border-bottom: 1px solid #ecedf0; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: #17191c;">
            Confirma
          </td>
        </tr>

        <!-- hero -->
        <tr>
          <td class="px hero-pt" style="padding: 40px 36px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
              <tr>
                <td bgcolor="#f5f8ff" style="border: 1px solid #dbe6fd; border-radius: 4px; padding: 5px 13px; font-family: Arial, sans-serif; font-size: 11.5px; font-weight: bold; color: #2f6bf3;">
                  Você está na lista
                </td>
              </tr>
            </table>
            <h1 class="h1" style="margin: 0 0 14px; font-family: Arial, sans-serif; font-size: 24px; line-height: 1.3; font-weight: bold; color: #17191c;">Prontinho, ${safeName}. Sua vaga no acesso antecipado está garantida.</h1>
            <p style="margin: 0 0 28px; font-family: Arial, sans-serif; font-size: 14.5px; line-height: 1.65; color: #4b5158;">Obrigado por entrar na lista de espera do Confirma. Você vai ser um dos primeiros a integrar e testar a confirmação automática de agenda — direto no WhatsApp que você já usa.</p>
          </td>
        </tr>

        <!-- cta -->
        <tr>
          <td class="px cta-pb" style="padding: 0 36px 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#2f6bf3" class="btn" style="border-radius: 8px;">
                  <a href="https://useconfirma.com.br/docs" style="display: inline-block; padding: 14px 26px; font-family: Arial, sans-serif; font-size: 14.5px; font-weight: bold; color: #ffffff; text-decoration: none;">Acessar a documentação</a>
                </td>
              </tr>
            </table>
            <p style="margin: 14px 0 0; font-family: Arial, sans-serif; font-size: 12.5px; line-height: 1.6; color: #8b9098;">A documentação da API já está disponível em <a href="https://useconfirma.com.br/docs" style="color: #2f6bf3; text-decoration: none;">useconfirma.com.br/docs</a> — dá pra começar a explorar agora.</p>
          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td align="center" class="px" style="padding: 22px 36px; border-top: 1px solid #ecedf0; font-family: Arial, sans-serif; font-size: 11.5px; line-height: 1.7; color: #a2a7af;">
            Confirma © 2026 — Confirmação de agenda via WhatsApp
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
