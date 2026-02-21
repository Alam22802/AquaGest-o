
import { AppState, NotificationSettings } from '../types';

export const sendEmailAlert = async (to: string, subject: string, body: string, settings?: NotificationSettings) => {
  console.log(`[ALERT] Enviando e-mail para: ${to}`);
  console.log(`[ALERT] Assunto: ${subject}`);
  console.log(`[ALERT] Mensagem: ${body}`);

  // Aqui seria a integração com um serviço real como SendGrid, Mailgun ou Supabase Edge Functions.
  // Como o ambiente é client-side, simulamos o disparo e registramos no log.
  
  // Opcional: Mostrar um alerta visual no app se o usuário master estiver logado
  return true;
};

export const checkAndTriggerAlerts = (state: AppState): {title: string, message: string} | null => {
  const settings = state.notificationSettings;
  if (!settings) return null;

  const masterUser = state.users.find(u => u.isMaster);
  const targetEmail = settings.systemEmailSender || masterUser?.email;

  if (!targetEmail) return null;

  // 1. Alerta de Estoque Baixo
  if (settings.notifyOnLowFeed) {
    for (const feed of state.feedTypes) {
      const stockKg = feed.totalStock / 1000;
      const percentage = feed.maxCapacity > 0 ? (stockKg / feed.maxCapacity) * 100 : 0;
      if (percentage <= feed.minStockPercentage) {
        const title = `ALERTA: Estoque Baixo - ${feed.name}`;
        const message = `O estoque de ${feed.name} está em ${percentage.toFixed(1)}% (${stockKg.toFixed(1)}kg).`;
        sendEmailAlert(targetEmail, title, message, settings);
        return { title, message };
      }
    }
  }

  // 2. Alerta de Novos Usuários
  if (settings.notifyMasterOnNewUser) {
    const pendingCount = state.users.filter(u => !u.isApproved).length;
    if (pendingCount > 0) {
      const title = `ALERTA: Novos Usuários Pendentes`;
      const message = `Existem ${pendingCount} usuários aguardando aprovação no sistema.`;
      sendEmailAlert(targetEmail, title, message, settings);
      return { title, message };
    }
  }

  // 3. Alerta de Qualidade da Água (Parâmetros Críticos)
  if (settings.notifyOnWaterCritical) {
    const lastLog = state.waterLogs[state.waterLogs.length - 1];
    if (lastLog) {
      if (lastLog.oxygen < 3 || lastLog.temperature > 32 || lastLog.ph < 6 || lastLog.ph > 9) {
        const title = `ALERTA CRÍTICO: Qualidade da Água`;
        const message = `Parâmetros fora do normal detectados em ${lastLog.date} ${lastLog.time}. O2: ${lastLog.oxygen}, Temp: ${lastLog.temperature}, pH: ${lastLog.ph}`;
        sendEmailAlert(targetEmail, title, message, settings);
        return { title, message };
      }
    }
  }

  return null;
};
