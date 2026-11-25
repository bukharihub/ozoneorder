const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_NAME = 'Ozone Enterprise ERP';
const DEVELOPER_NAME = 'Syed Shoaib Ali Shah Bukhari (Bukharihub)';
const WINDOW_TITLE = `${APP_NAME} — Developed by ${DEVELOPER_NAME}`;
const COPYRIGHT = '© 2026 Syed Shoaib Ali Shah Bukhari (Bukharihub). All Rights Reserved.';
const ABOUT_TEXT = `Engineered & Developed by ${DEVELOPER_NAME}\n${COPYRIGHT}`;
const APP_URL = app.isPackaged ? 'https://ozoneso.vercel.app' : 'http://localhost:3000';
const LOCK_FILE = path.join(__dirname, 'locked-company.json');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function readExpiredLicense() {
  try {
    const config = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
    const expiry = new Date(`${config.expiryDate}T23:59:59`);
    if (Number.isFinite(expiry.getTime()) && expiry.getTime() < Date.now()) return config;
  } catch (error) {}
  return null;
}

function offlinePage(detail) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(WINDOW_TITLE)}</title><style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#020617;color:#e2e8f0;font-family:Segoe UI,Arial,sans-serif}
    main{width:min(620px,90vw);padding:36px;border:1px solid #22d3ee55;border-radius:20px;background:#0f172a;text-align:center;box-shadow:0 24px 80px #0008}
    .mark{width:56px;height:56px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;border:1px solid #22d3ee66;border-radius:16px;color:#67e8f9;font-size:24px;font-weight:800}
    h1{margin:0 0 10px;color:#a5f3fc;font-size:24px}p{line-height:1.7;color:#cbd5e1;font-size:14px}.detail{margin-top:16px;padding:12px;border-radius:10px;background:#020617;color:#fda4af;font-family:Consolas,monospace;font-size:12px;word-break:break-word}
    button{margin-top:22px;padding:12px 26px;border:0;border-radius:10px;background:#06b6d4;color:#020617;font-weight:800;font-size:13px;cursor:pointer}button:hover{background:#22d3ee}
    .brand{margin-top:22px;padding-top:16px;border-top:1px solid #22d3ee22;color:#94a3b8;font-size:11px}.brand strong{color:#67e8f9}
  </style></head><body><main><div class="mark">OZ</div>
    <h1>Ozone Enterprise ERP is offline</h1>
    <p>We could not reach the ERP server. Check your internet connection, then retry.</p>
    <p class="detail">${escapeHtml(detail || 'No response from the server.')}</p>
    <button type="button" onclick="window.location.replace(${JSON.stringify(APP_URL)})">Retry Connection</button>
    <p class="brand">Engineered &amp; Developed by <strong>${escapeHtml(DEVELOPER_NAME)}</strong><br />${escapeHtml(COPYRIGHT)}</p>
  </main></body></html>`;
}

function loadOfflineScreen(win, detail) {
  if (!win || win.isDestroyed()) return;
  win.setTitle(WINDOW_TITLE);
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(offlinePage(detail))}`);
}

function loadApp(win) {
  win.setTitle(WINDOW_TITLE);
  win.loadURL(APP_URL).catch((error) => {
    loadOfflineScreen(win, error && error.message ? error.message : 'Unable to reach the ERP server.');
  });
}

function printFocusedWindow() {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) win.webContents.print({ printBackground: true });
}

function createLockWindow(config) {
  const win = new BrowserWindow({
    title: WINDOW_TITLE,
    width: 900,
    height: 640,
    backgroundColor: '#020617',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, partition: 'persist:ozone-enterprise' },
  });

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(WINDOW_TITLE)}</title><style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#020617;color:#e2e8f0;font-family:Segoe UI,Arial,sans-serif;text-align:center}
    .box{max-width:620px;padding:32px;border:1px solid #f43f5e55;border-radius:18px;background:#f43f5e0d}
    h1{color:#fda4af;font-size:28px;line-height:1.25}p{line-height:1.7}.d{color:#67e8f9;font-weight:700}
  </style></head><body><div class="box"><h1>System Access Locked — Company License Expired</h1>
    <p>Your 40-day software license has expired and system access has been disabled. Please contact the software administrator to renew your license.</p>
    <p class="d">${escapeHtml(config.companyName || config.companyCode)} · ${escapeHtml(config.companyCode)} · Expired ${escapeHtml(config.expiryDate)}</p>
    <p>OZONE ENTERPRISE Support — Karachi | Contact Vendor for License Renewal</p>
    <p class="d">Engineered & Developed by ${escapeHtml(DEVELOPER_NAME)}</p>
    <p>${escapeHtml(COPYRIGHT)}</p></div></body></html>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function installApplicationMenu() {
  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: app.getVersion(),
    copyright: COPYRIGHT,
    authors: [DEVELOPER_NAME],
    credits: `Engineered & Developed by ${DEVELOPER_NAME}`,
  });

  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Print', accelerator: 'CmdOrCtrl+P', click: () => printFocusedWindow() },
        { type: 'separator' },
        { label: 'Exit', accelerator: 'Alt+F4', click: () => app.quit() },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: `About ${APP_NAME}`,
          click: () => {
            dialog.showMessageBoxSync({
              type: 'info',
              title: WINDOW_TITLE,
              message: APP_NAME,
              detail: ABOUT_TEXT,
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const win = new BrowserWindow({
    title: WINDOW_TITLE,
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:ozone-enterprise',
      spellcheck: false,
    },
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3 || !validatedURL || validatedURL.startsWith('data:')) return;
    loadOfflineScreen(win, `${errorDescription || 'Connection failed'} (error ${errorCode})`);
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta) || input.shift || input.alt) return;
    if (input.key.toLowerCase() !== 'p') return;
    event.preventDefault();
    win.webContents.print({ printBackground: true });
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  loadApp(win);
  return win;
}

app.whenReady().then(() => {
  installApplicationMenu();
  const expired = readExpiredLicense();
  if (expired) {
    createLockWindow(expired);
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createLockWindow(expired);
    });
  } else {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
