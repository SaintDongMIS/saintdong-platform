import { apiLogger } from '../../../services/LoggerService';
import {
  clearFinanceSessionCookie,
  getFinanceUserFromEvent,
} from '../../../utils/financeAuth';

export default defineEventHandler((event) => {
  const user = getFinanceUserFromEvent(event);
  clearFinanceSessionCookie(event);

  if (user) {
    apiLogger.info('finance-auth logout', { username: user });
  }

  return { ok: true };
});
