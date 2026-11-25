const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { build } = require('electron-builder');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

const flag = (name) => {
  const prefixed = args.find((value) => value.startsWith(`${name}=`));
  if (prefixed) return prefixed.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

dotenv.config({ path: path.join(root, '.env.local') });

const companyCode = String(flag('--company') || '').trim().toUpperCase();
const expiryDate = String(flag('--expiry') || '').trim();
const companyName = String(flag('--name') || companyCode).trim();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!/^[A-Z0-9_-]+$/.test(companyCode)) {
  console.error('Usage: npm run electron:build:company -- --company=CODE --expiry=YYYY-MM-DD [--name="Company Name"]');
  process.exit(1);
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) || Number.isNaN(Date.parse(`${expiryDate}T00:00:00Z`))) {
  console.error('--expiry must be a valid date in YYYY-MM-DD format');
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL and anon key are missing from .env.local');
  process.exit(1);
}

const pkg = require(path.join(root, 'package.json'));
const envFile = path.join(root, '.env.company');
const lockFile = path.join(root, 'electron', 'locked-company.json');
const npmCommand = 'npm';

const lockedEnv = {
  NEXT_PUBLIC_LOCKED_COMPANY_CODE: companyCode,
  NEXT_PUBLIC_LOCKED_COMPANY_NAME: companyName,
  NEXT_PUBLIC_LOCKED_EXPIRY_DATE: expiryDate,
};

const env = {
  ...process.env,
  ...lockedEnv,
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseKey,
  VITE_LOCKED_COMPANY_CODE: companyCode,
  VITE_LOCKED_COMPANY_NAME: companyName,
  VITE_LOCKED_EXPIRY_DATE: expiryDate,
  VITE_SUPABASE_URL: supabaseUrl,
  VITE_SUPABASE_ANON_KEY: supabaseKey,
};

try {
  fs.writeFileSync(
    envFile,
    [
      ...Object.entries(lockedEnv).map(([key, value]) => `${key}=${value}`),
      `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseKey}`,
      '',
    ].join('\n'),
  );

  const compiled = spawnSync(npmCommand, ['run', 'build'], { cwd: root, env, stdio: 'inherit', shell: true });
  if (compiled.error) throw compiled.error;
  if (compiled.status !== 0) process.exit(compiled.status || 1);

  fs.writeFileSync(lockFile, JSON.stringify({ companyCode, companyName, expiryDate }, null, 2));

  build({
    config: {
      ...pkg.build,
      appId: `${pkg.build.appId}.${companyCode.toLowerCase()}`,
      productName: `${companyCode} Enterprise ERP`,
      publish: null,
      win: {
        ...pkg.build.win,
        target: [{ target: 'nsis', arch: ['x64'] }],
        artifactName: `${companyCode}-Enterprise-Setup-${pkg.version}.exe`,
      },
      nsis: {
        ...pkg.build.nsis,
        shortcutName: `${companyCode} Enterprise ERP`,
      },
    },
  })
    .then(() => {
      fs.rmSync(lockFile, { force: true });
      console.log(`\nInstaller: ${path.join(root, 'release', `${companyCode}-Enterprise-Setup-${pkg.version}.exe`)}`);
    })
    .catch((error) => {
      fs.rmSync(lockFile, { force: true });
      console.error(error);
      process.exit(1);
    });
} catch (error) {
  fs.rmSync(lockFile, { force: true });
  console.error(error);
  process.exit(1);
}
