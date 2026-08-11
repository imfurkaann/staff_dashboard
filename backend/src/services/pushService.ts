import webpush, { PushSubscription as WebPushSubscription } from 'web-push';
import prisma from '../db/prisma';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';

interface SubscriptionInput {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

export class PushService {
  private static configured = false;
  private static configurationAttempted = false;

  private static configure() {
    if (this.configurationAttempted) return;
    this.configurationAttempted = true;
    if (!config.push.publicKey || !config.push.privateKey) return;
    try {
      webpush.setVapidDetails(config.push.subject, config.push.publicKey, config.push.privateKey);
      this.configured = true;
    } catch (error) {
      console.error('Push notification configuration is invalid', { name: error instanceof Error ? error.name : 'UnknownError' });
    }
  }

  static isConfigured() {
    this.configure();
    return this.configured;
  }

  static getPublicKey() {
    if (!this.isConfigured()) throw new AppError('Push bildirimleri sunucuda geçerli anahtarlarla yapılandırılmamış.', 503);
    return config.push.publicKey;
  }

  static async subscribe(userId: string, input: SubscriptionInput, userAgent?: string) {
    const endpoint = typeof input?.endpoint === 'string' ? input.endpoint.trim() : '';
    const p256dh = typeof input?.keys?.p256dh === 'string' ? input.keys.p256dh : '';
    const auth = typeof input?.keys?.auth === 'string' ? input.keys.auth : '';
    const base64UrlPattern = /^[A-Za-z0-9_-]+={0,2}$/;
    if (!endpoint.startsWith('https://') || endpoint.length > 2048 ||
        p256dh.length < 40 || p256dh.length > 200 || !base64UrlPattern.test(p256dh) ||
        auth.length < 8 || auth.length > 100 || !base64UrlPattern.test(auth)) {
      throw new AppError('Geçersiz push aboneliği.', 400);
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.pushSubscription.findUnique({ where: { endpoint }, select: { id: true, userId: true } });
      if (existing && existing.userId !== userId) {
        throw new AppError('Bu push aboneliği başka bir kullanıcı hesabına bağlı.', 409);
      }
      if (existing) {
        return tx.pushSubscription.update({
          where: { id: existing.id },
          data: { p256dh, auth, userAgent: userAgent?.slice(0, 500) },
        });
      }
      return tx.pushSubscription.create({
        data: { userId, endpoint, p256dh, auth, userAgent: userAgent?.slice(0, 500) },
      });
    });
  }

  static async unsubscribe(userId: string, endpoint: unknown) {
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > 2048) {
      throw new AppError('Geçersiz abonelik adresi.', 400);
    }
    await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  static async sendToUsers(userIds: string[], payload: Record<string, unknown>) {
    this.configure();
    if (!this.configured) return { sent: 0, failed: 0, disabled: true };
    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
    let sent = 0;
    let failed = 0;

    let cursor = 0;
    const deliverNext = async () => {
      const index = cursor++;
      if (index >= subscriptions.length) return;
      const item = subscriptions[index];
      const subscription: WebPushSubscription = {
        endpoint: item.endpoint,
        keys: { p256dh: item.p256dh, auth: item.auth },
      };
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 86400, timeout: 10_000 });
        sent += 1;
      } catch (error: any) {
        failed += 1;
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: item.id } }).catch(() => undefined);
        } else {
          console.error('Push notification delivery failed', { statusCode: error?.statusCode, subscriptionId: item.id });
        }
      }
      await deliverNext();
    };
    await Promise.all(Array.from({ length: Math.min(25, subscriptions.length) }, () => deliverNext()));
    return { sent, failed, disabled: false };
  }

  static queueToUsers(userIds: string[], payload: Record<string, unknown>) {
    const disabled = !this.isConfigured();
    if (!disabled) {
      setImmediate(() => {
        void this.sendToUsers(userIds, payload).catch((error) => {
          console.error('Queued push notification delivery failed', { name: error instanceof Error ? error.name : 'UnknownError' });
        });
      });
    }
    return { sent: 0, failed: 0, disabled, queued: !disabled };
  }
}
