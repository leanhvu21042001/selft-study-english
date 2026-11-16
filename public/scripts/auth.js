let currentUser = null;
let authReadyResolve;
const authReady = new Promise(resolve => { authReadyResolve = resolve; });

function getAuthToken() {
  return localStorage.getItem('eng_auth_token') || '';
}

function clearBrowserKeys() {
  localStorage.clear();
  sessionStorage.clear();
}

function logout() {
  clearBrowserKeys();
  window.location.reload();
}

function authUrl(action) {
  const url = getGasUrl();
  return url + (url.includes('?') ? '&' : '?') + 'action=' + encodeURIComponent(action);
}

function authOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'authOverlay';
  overlay.innerHTML = `
    <div class="auth-card">
      <h2>Đăng nhập để học</h2>
      <p class="sub">Mỗi người học có tiến độ và nhật ký riêng. Tối đa 1000 tài khoản.</p>
      <form id="loginForm">
        <label>Email</label>
        <input id="authEmail" type="email" required autocomplete="email" placeholder="ban@example.com">
        <label>Mã khóa cá nhân</label>
        <input id="authCode" type="password" required minlength="4" autocomplete="current-password" placeholder="Nhập mã khóa">
        <button class="btn btn-primary" type="submit">Vào học</button>
      </form>
      <button id="resetRequestButton" class="auth-link" type="button">Quên mã? Gửi đường link cập nhật</button>
      <div id="authMessage" class="auth-message"></div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('loginForm').addEventListener('submit', login);
  document.getElementById('resetRequestButton').addEventListener('click', requestReset);
  return overlay;
}

function showAuthMessage(message, isError) {
  const messageBox = document.getElementById('authMessage');
  if (messageBox) {
    messageBox.textContent = message;
    messageBox.className = 'auth-message ' + (isError ? 'err' : 'ok');
  }
}

async function login(event) {
  event.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const code = document.getElementById('authCode').value;
  try {
    const response = await fetch(authUrl('login'), {
      method: 'POST',
      body: JSON.stringify({ action: 'login', email: email, code: code })
    });
    const result = await response.json();
    if (!result.ok) {
      showAuthMessage(result.error || 'Không thể đăng nhập.', true);
      return;
    }
    localStorage.setItem('eng_auth_token', result.token);
    localStorage.setItem('eng_auth_email', result.email);
    localStorage.setItem('eng_auth_version', String(result.codeVersion || 1));
    currentUser = result;
    document.getElementById('authOverlay').remove();
    authReadyResolve(result);
  } catch (error) {
    showAuthMessage('Không kết nối được hệ thống xác thực.', true);
  }
}

async function requestReset() {
  const email = document.getElementById('authEmail').value.trim();
  if (!email) {
    showAuthMessage('Hãy nhập email trước.', true);
    return;
  }
  try {
    const response = await fetch(authUrl('requestReset'), {
      method: 'POST',
      body: JSON.stringify({
        action: 'requestReset',
        email: email,
        resetUrl: window.location.origin + window.location.pathname
      })
    });
    const result = await response.json();
    showAuthMessage(result.message || 'Đã gửi yêu cầu.', false);
  } catch (error) {
    showAuthMessage('Không gửi được yêu cầu cập nhật mã.', true);
  }
}

async function resetCodeFromLink() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('reset');
  const email = params.get('email') || '';
  if (!token) return false;
  const overlay = authOverlay();
  overlay.querySelector('.auth-card').innerHTML = `
    <h2>Đặt mã khóa mới</h2>
    <p class="sub">Mã mới sẽ áp dụng cho mọi trang học và thu hồi các phiên cũ.</p>
    <form id="newCodeForm">
      <label>Email</label>
      <input id="resetEmail" type="email" required value="${email.replace(/"/g, '&quot;')}">
      <label>Mã khóa mới</label>
      <input id="newCode" type="password" required minlength="4" autocomplete="new-password">
      <button class="btn btn-primary" type="submit">Cập nhật mã</button>
    </form>
    <div id="authMessage" class="auth-message"></div>`;
  document.getElementById('newCodeForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const response = await fetch(authUrl('resetCode'), {
        method: 'POST',
        body: JSON.stringify({
          action: 'resetCode',
          email: document.getElementById('resetEmail').value.trim(),
          code: document.getElementById('newCode').value,
          token: token
        })
      });
      const result = await response.json();
      if (!result.ok) {
        showAuthMessage(result.error, true);
        return;
      }
      showAuthMessage(result.message + ' Hãy đăng nhập bằng mã mới.', false);
      history.replaceState({}, document.title, window.location.pathname);
      clearBrowserKeys();
      window.location.reload();
    } catch (error) {
      showAuthMessage('Không cập nhật được mã khóa.', true);
    }
  });
  return true;
}

async function initializeAuth() {
  if (await resetCodeFromLink()) return;
  const token = getAuthToken();
  if (!token) {
    authOverlay();
    return;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    if (getAuthToken() !== token) return;
    try {
      const response = await fetch(authUrl('authStatus')
        + '&token=' + encodeURIComponent(token)
        + '&email=' + encodeURIComponent(localStorage.getItem('eng_auth_email') || '')
        + '&codeVersion=' + encodeURIComponent(localStorage.getItem('eng_auth_version') || '0'));
      const result = await response.json();
      if (result.ok) {
        currentUser = result;
        localStorage.setItem('eng_auth_version', String(result.codeVersion || 1));
        authReadyResolve(result);
        return;
      }
      if (result.authRequired && result.reason === 'CODE_CHANGED') {
        clearBrowserKeys();
        authOverlay();
        showAuthMessage('Phiên học đã hết hạn hoặc mã khóa đã được cập nhật. Hãy đăng nhập lại.', true);
        return;
      }
    } catch (error) {
      if (getAuthToken() !== token) return;
    }
    await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
  }
  if (getAuthToken() === token) {
    currentUser = { email: localStorage.getItem('eng_auth_email') || '' };
    authReadyResolve(currentUser);
  }
}

function authRequestBody(body) {
  return Object.assign({}, body, {
    token: getAuthToken(),
    email: localStorage.getItem('eng_auth_email') || '',
    codeVersion: localStorage.getItem('eng_auth_version') || '0'
  });
}

function ensureAuthResponse(result) {
  if (result && result.authRequired && result.reason === 'CODE_CHANGED') {
    clearBrowserKeys();
    window.location.reload();
    throw new Error('AUTH_REQUIRED');
  }
  return result;
}

initializeAuth();
