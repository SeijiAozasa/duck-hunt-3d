/**
 * DUCK HUNT 3D - CLOUD FUNCTIONS AUTOMATION
 * Cron Job Mensal: Arquivamento de Ranking, Reset e Envio de E-mails aos Vencedores
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
require("dotenv").config();

admin.initializeApp();
const db = admin.firestore();

// Configuração do Transportador Nodemailer com variáveis de ambiente
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Função utilitária para obter a string YYYY-MM do mês anterior
 */
function getPreviousMonthString() {
  const now = new Date();
  now.setDate(1);
  now.setMonth(now.getMonth() - 1);
  return now.toISOString().slice(0, 7); // ex: "2026-09"
}

/**
 * Monta o HTML do E-mail com estética Retro Arcade dos Anos 90
 */
function buildArcadeEmailTemplate(monthStr, topScores) {
  let rowsHtml = "";

  if (topScores.length === 0) {
    rowsHtml = `<tr><td colspan="4" style="padding: 12px; text-align: center; color: #888;">Nenhuma pontuação registrada no período.</td></tr>`;
  } else {
    topScores.forEach((item, index) => {
      const pos = index + 1;
      const medal = pos === 1 ? "🥇 1º LUGAR" : (pos === 2 ? "🥈 2º LUGAR" : (pos === 3 ? "🥉 3º LUGAR" : `${pos}º`));
      const rowColor = pos === 1 ? "#ffd700" : (pos === 2 ? "#c0c0c0" : (pos === 3 ? "#cd7f32" : "#ffffff"));
      
      rowsHtml += `
        <tr style="border-bottom: 1px solid #333;">
          <td style="padding: 10px; font-weight: bold; color: ${rowColor};">${medal}</td>
          <td style="padding: 10px; color: #ffffff;">${item.name || "ANÔNIMO"}</td>
          <td style="padding: 10px; color: #00e436; font-family: monospace; font-size: 16px;">${String(item.score).padStart(6, "0")}</td>
          <td style="padding: 10px; color: #29adff;">${item.accuracy || 100}% (Round ${item.round || 1})</td>
        </tr>
      `;
    });
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Boletim Oficial de Campeões - Duck Hunt 3D</title>
    </head>
    <body style="margin: 0; padding: 24px; background-color: #0d1117; font-family: 'Courier New', Courier, monospace; color: #ffffff;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #161b22; border: 4px solid #00e436; border-radius: 8px; overflow: hidden; box-shadow: 0 0 20px rgba(0, 228, 54, 0.4);">
        <!-- CABEÇALHO ARCADE -->
        <tr style="background-color: #000000; border-bottom: 3px solid #ffa300;">
          <td style="padding: 24px; text-align: center;">
            <h1 style="color: #ffa300; margin: 0; font-size: 26px; letter-spacing: 2px;">🎮 DUCK HUNT 3D ARCADE</h1>
            <p style="color: #00e436; margin: 8px 0 0 0; font-size: 14px;">RELATÓRIO MENSAL DE CAMPEÕES // ${monthStr}</p>
          </td>
        </tr>

        <!-- CORPO PRINCIPAL -->
        <tr>
          <td style="padding: 24px;">
            <p style="color: #e6edf3; font-size: 14px; line-height: 1.6;">
              O mês de <strong>${monthStr}</strong> chegou ao fim e a temporada foi oficialmente encerrada! 
              Abaixo estão os 10 maiores atiradores de elite que dominaram os lagos e superaram os desafios do Duck Hunt 3D.
            </p>

            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top: 16px; border-collapse: collapse; background-color: #0d1117; border-radius: 6px;">
              <thead>
                <tr style="background-color: #21262d; border-bottom: 2px solid #30363d;">
                  <th style="padding: 10px; text-align: left; color: #ffa300; font-size: 12px;">POS</th>
                  <th style="padding: 10px; text-align: left; color: #ffa300; font-size: 12px;">PILOTO / ATIRADOR</th>
                  <th style="padding: 10px; text-align: left; color: #ffa300; font-size: 12px;">SCORE</th>
                  <th style="padding: 10px; text-align: left; color: #ffa300; font-size: 12px;">PRECISÃO</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div style="margin-top: 24px; padding: 16px; background-color: #000000; border-left: 4px solid #29adff; border-radius: 4px;">
              <p style="margin: 0; font-size: 12px; color: #8b949e;">
                ℹ️ <strong>Status do Sistema:</strong> O ranking ativo foi resetado para a nova temporada. Todos os registros anteriores foram arquivados com sucesso na coleção histórica.
              </p>
            </div>
          </td>
        </tr>

        <!-- RODAPÉ -->
        <tr style="background-color: #090d13; border-top: 1px solid #30363d;">
          <td style="padding: 16px; text-align: center; font-size: 11px; color: #8b949e;">
            Duck Hunt 3D (90s Arcade Edition) &bull; Gerado automaticamente via Google Cloud Functions
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Lógica principal de arquivamento, envio de e-mail e reset
 */
async function executeMonthlyRankingCycle(targetMonth) {
  const month = targetMonth || getPreviousMonthString();
  functions.logger.info(`Iniciando ciclo de reset mensal para o período: ${month}`);

  const scoresRef = db.collection("monthly_scores");

  // 1. Busca os Top 10 do mês especificado
  const snapshot = await scoresRef
    .where("month", "==", month)
    .orderBy("score", "desc")
    .limit(10)
    .get();

  const topScores = [];
  snapshot.forEach((doc) => {
    topScores.push({ id: doc.id, ...doc.data() });
  });

  functions.logger.info(`Top scores obtidos para ${month}: ${topScores.length} registros encontrados.`);

  // 2. Arquiva o resultado consolidado no histórico
  const archiveRef = db.collection("historical_rankings").doc(month);
  await archiveRef.set({
    month: month,
    archivedAt: admin.firestore.FieldValue.serverTimestamp(),
    topScores: topScores,
    totalRecords: topScores.length,
    status: "CLOSED",
  });
  functions.logger.info(`Ranking arquivado com sucesso em historical_rankings/${month}`);

  // 3. Monta e envia e-mail com o relatório dos vencedores
  const emailHtml = buildArcadeEmailTemplate(month, topScores);
  const mailOptions = {
    from: process.env.NOTIFICATION_EMAIL_FROM || '"Duck Hunt 3D Arcade" <arcade@duckhunt3d.com>',
    to: process.env.NOTIFICATION_EMAIL_TO || "admin@seujogo.com",
    subject: `🏆 Duck Hunt 3D: Campeões do Mês [${month}] & Reset Realizado!`,
    html: emailHtml,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    functions.logger.info(`E-mail de notificação enviado com sucesso: ${info.messageId}`);
  } catch (emailErr) {
    functions.logger.error("Erro ao enviar e-mail via SMTP:", emailErr);
  }

  // 4. Limpeza em lote (Batch Delete) das pontuações do mês antigo (ou marcação como arquivado)
  const allMonthScoresSnapshot = await scoresRef.where("month", "==", month).get();
  if (!allMonthScoresSnapshot.empty) {
    const batch = db.batch();
    allMonthScoresSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    functions.logger.info(`Removidos ${allMonthScoresSnapshot.size} documentos do mês ${month} da coleção ativa.`);
  }

  return {
    success: true,
    month: month,
    archivedCount: topScores.length,
    cleanedCount: allMonthScoresSnapshot.size,
  };
}

/**
 * CRON JOB AGENDADO:
 * Executa todo dia 1º de cada mês às 00:00 (Fuso horário configurado no .env)
 */
exports.monthlyRankingResetCron = functions.pubsub
  .schedule("0 0 1 * *")
  .timeZone(process.env.TIMEZONE || "America/Sao_Paulo")
  .onRun(async (context) => {
    try {
      const result = await executeMonthlyRankingCycle();
      functions.logger.info("Cron de reset de ranking executado com sucesso!", result);
      return result;
    } catch (err) {
      functions.logger.error("Falha na execução do Cron de reset de ranking:", err);
      throw err;
    }
  });

/**
 * TRIGGER HTTP MANUAL:
 * Permite que administradores acionem o reset e teste de e-mail manualmente a qualquer momento.
 * Exemplo de chamada: GET/POST https://<region>-<project>.cloudfunctions.net/manualMonthlyReset?month=2026-09
 */
exports.manualMonthlyReset = functions.https.onRequest(async (req, res) => {
  try {
    const targetMonth = req.query.month || req.body.month;
    const result = await executeMonthlyRankingCycle(targetMonth);
    res.status(200).json({
      message: "Ciclo de ranking mensal executado com sucesso!",
      result,
    });
  } catch (err) {
    functions.logger.error("Erro ao executar trigger manual:", err);
    res.status(500).json({
      error: "Falha na execução do ciclo mensal",
      details: err.message,
    });
  }
});
