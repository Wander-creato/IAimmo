import type { Lead } from "@/lib/agent/hunterAgent";

export type WebhookConfig = {
  telegramBotToken?: string;
  telegramChatId?: string;
  slackWebhookUrl?: string;
};

const HOT_SCORE_THRESHOLD = 0.8;

function buildHotLeadMessage(lead: Lead) {
  return [
    "🔥 NOUVELLE OPPORTUNITÉ PARTICULIER",
    `📍 Quartier: ${lead.district}`,
    `💰 Prix: ${lead.priceXpf.toLocaleString("fr-FR")} XPF`,
    `📝 Pitch: ${lead.salesPitch[1]}`,
    `🔗 Lien: ${lead.url}`,
  ].join("\n");
}

async function postToTelegram(message: string, config: WebhookConfig) {
  if (!config.telegramBotToken || !config.telegramChatId) {
    return false;
  }

  const endpoint = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      text: message,
    }),
    cache: "no-store",
  });

  return response.ok;
}

async function postToSlack(message: string, config: WebhookConfig) {
  if (!config.slackWebhookUrl) {
    return false;
  }

  const response = await fetch(config.slackWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
    cache: "no-store",
  });

  return response.ok;
}

export async function notifyHotLeads(
  leads: Lead[],
  config: WebhookConfig = {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
  },
) {
  const hotLeads = leads.filter(
    (lead) => lead.temperature === "Hot" && lead.score > HOT_SCORE_THRESHOLD,
  );

  const deliveryResults = await Promise.all(
    hotLeads.map(async (lead) => {
      const message = buildHotLeadMessage(lead);
      const [telegramSent, slackSent] = await Promise.all([
        postToTelegram(message, config),
        postToSlack(message, config),
      ]);

      return {
        leadId: lead.id,
        delivered: telegramSent || slackSent,
      };
    }),
  );

  return {
    sent: deliveryResults.filter((result) => result.delivered).length,
    attempted: hotLeads.length,
  };
}
