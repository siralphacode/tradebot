export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  initialPrice: number;
  condition: "ABOVE" | "BELOW";
  note?: string;
  active: boolean;
  triggered: boolean;
  createdAt: number;
  triggeredAt?: number;
}

const STORAGE_KEY = "crypto_price_alerts_v1";

export function loadAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Failed to load price alerts:", e);
  }
  return [];
}

export function saveAlerts(alerts: PriceAlert[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch (e) {
    console.error("Failed to save price alerts:", e);
  }
}

// Play pleasant web audio chime without external file dependencies
export function playAlertChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    // Two-tone bell chime (880Hz then 1320Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.8);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1760, now + 0.18);
    gain2.gain.setValueAtTime(0.2, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 1.1);
  } catch {
    // AudioContext blocked by browser policy until user gesture
  }
}

// Trigger native browser notification
export function sendBrowserNotification(alert: PriceAlert, currentPrice: number): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission === "granted") {
    try {
      const title = `Price Alert Triggered: ${alert.symbol}`;
      const body = `${alert.symbol} has reached your target of $${alert.targetPrice.toLocaleString()}! Current price: $${currentPrice.toLocaleString()}${
        alert.note ? `\nNote: ${alert.note}` : ""
      }`;

      const notification = new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: `price-alert-${alert.id}`,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (e) {
      console.error("Browser notification failed:", e);
    }
  }
}

// Check all active alerts against latest price updates
export function checkAlertsTriggered(
  alerts: PriceAlert[],
  currentPrices: Record<string, number>
): { updatedAlerts: PriceAlert[]; newlyTriggered: { alert: PriceAlert; price: number }[] } {
  let hasChanges = false;
  const newlyTriggered: { alert: PriceAlert; price: number }[] = [];

  const updatedAlerts = alerts.map((alert) => {
    if (!alert.active || alert.triggered) return alert;

    const price = currentPrices[alert.symbol];
    if (price === undefined || price <= 0) return alert;

    let isTriggered = false;
    if (alert.condition === "ABOVE" && price >= alert.targetPrice) {
      isTriggered = true;
    } else if (alert.condition === "BELOW" && price <= alert.targetPrice) {
      isTriggered = true;
    }

    if (isTriggered) {
      hasChanges = true;
      const triggeredAlert = {
        ...alert,
        active: false,
        triggered: true,
        triggeredAt: Date.now(),
      };
      newlyTriggered.push({ alert: triggeredAlert, price });
      return triggeredAlert;
    }

    return alert;
  });

  if (hasChanges) {
    saveAlerts(updatedAlerts);
  }

  return { updatedAlerts, newlyTriggered };
}
