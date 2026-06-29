import { getFinanceUserFromEvent } from '../../../utils/financeAuth';

export default defineEventHandler((event) => {
  const user = getFinanceUserFromEvent(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: '未登入或 session 已過期',
    });
  }

  return { username: user };
});
