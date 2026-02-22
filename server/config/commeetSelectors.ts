/**
 * COMMEET 登入頁面的 CSS 選擇器
 * 來源：Axiom Browser Automation 流程
 * 
 * 如果 COMMEET 改版導致選擇器失效，只需在此檔案更新即可
 */

export const commeetSelectors = {
  /**
   * Email 輸入欄位
   * 步驟 3：Enter text: E-mail 帳號
   */
  emailInput: 'div:nth-of-type(2) > div:nth-of-type(1) > div > input',

  /**
   * 密碼輸入欄位
   * 步驟 4：Enter text: 密碼
   */
  passwordInput: 'div:nth-of-type(2) > div:nth-of-type(1) > input',

  /**
   * 登入按鈕
   * 步驟 5：Click element: 登入
   * 實際 DOM: <button data-testid="btn-login">
   */
  loginButton: 'button[data-testid="btn-login"]',
} as const;
