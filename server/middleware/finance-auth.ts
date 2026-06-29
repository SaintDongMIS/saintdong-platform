import {
  getFinanceUserFromEvent,
  isFinanceProtectedApiPath,
} from '../utils/financeAuth';

export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname;
  if (!isFinanceProtectedApiPath(pathname)) return;

  const user = getFinanceUserFromEvent(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: '未登入或 session 已過期',
    });
  }

  event.context.financeUser = user;
});
