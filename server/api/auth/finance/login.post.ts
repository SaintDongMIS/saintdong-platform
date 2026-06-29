import { apiLogger } from '../../../services/LoggerService';
import {
  setFinanceSessionCookie,
  verifyFinanceCredentials,
  getFinanceAuthSecrets,
  type FinanceUser,
} from '../../../utils/financeAuth';

interface LoginBody {
  username?: string;
  password?: string;
}

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginBody>(event);
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const clientIp =
    getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
    event.node.req.socket.remoteAddress ||
    'unknown';

  const { password: expectedPassword, secret } = getFinanceAuthSecrets();
  if (!expectedPassword || !secret) {
    throw createError({
      statusCode: 503,
      statusMessage: '財務登入尚未設定',
    });
  }

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: '請輸入帳號與密碼',
    });
  }

  if (!verifyFinanceCredentials(username, password, expectedPassword)) {
    apiLogger.warn('finance-auth login failed', { username, ip: clientIp });
    throw createError({
      statusCode: 401,
      statusMessage: '帳號或密碼錯誤',
    });
  }

  setFinanceSessionCookie(event, username as FinanceUser);
  apiLogger.info('finance-auth login ok', { username, ip: clientIp });

  return { username };
});
