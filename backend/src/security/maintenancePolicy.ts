import { MaintenanceStatus } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateMaintenanceId(value: unknown, label = 'Arıza kaydı kimliği'): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new AppError(`${label} geçersiz.`, 400);
  return value;
}

export function assertMaintenanceTransition(current: MaintenanceStatus, target: MaintenanceStatus, canReopen: boolean) {
  if (current === target) return;
  if ((current === 'RESOLVED' || current === 'CLOSED') && target === 'OPEN') {
    if (!canReopen) throw new AppError('Çözülmüş veya kapatılmış arıza kaydını yalnızca tam güncelleme yetkili kullanıcı yeniden açabilir.', 403);
    return;
  }
  if (current === 'CLOSED') throw new AppError('Kapatılmış arıza kaydı yalnızca yeniden açılarak değiştirilebilir.', 409);
  if (current === 'RESOLVED' && target !== 'CLOSED') throw new AppError('Çözülmüş kayıt yalnızca kapatılabilir veya yetkili kullanıcı tarafından yeniden açılabilir.', 409);
}

export function assertClosedMaintenanceEditable(status: MaintenanceStatus, canFullUpdate: boolean) {
  if ((status === 'RESOLVED' || status === 'CLOSED') && !canFullUpdate) {
    throw new AppError('Çözülmüş veya kapatılmış arıza kayıtlarını yalnızca tam güncelleme yetkili kullanıcı değiştirebilir.', 403);
  }
}
