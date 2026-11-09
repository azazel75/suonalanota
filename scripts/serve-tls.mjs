/**
 * :Project:  suona-la-nota -- dist/ over https, so a phone will use its microphone
 * :Created:  sab 07 nov 2026 23:17:57 CET
 * :Author:   Alberto Berti <alberto@metapensiero.it>
 * :License:  GNU General Public License version 3 or later
 *
 * getUserMedia exists only in a secure context, and http://192.168.x.y is not
 * one. This serves the built directory — `dist/`, relative to the working
 * directory — over https with a certificate openssl generates for the occasion,
 * valid for localhost and for every local IPv4 the machine currently has. The
 * browser will still warn: accept once per device. Once the port answers, the
 * page is opened with `xdg-open`; `OPEN=0` keeps it quiet.
 *
 * Not a deployment: there is no cache header, no compression and no range
 * request here, because none of that is what this server is for.
 */
import { execFileSync, spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(process.cwd(), 'dist');
const CERT_DIR = resolve(process.cwd(), '.scratch', 'tls');
const PORT = Number(process.env['PORT'] ?? 8443);

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.webmanifest', 'application/manifest+json'],
]);

function localAddresses() {
  const addresses = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses;
}

function ensureCertificate(addresses) {
  const keyPath = join(CERT_DIR, 'key.pem');
  const certPath = join(CERT_DIR, 'cert.pem');
  if (existsSync(keyPath) && existsSync(certPath)) return { keyPath, certPath };

  mkdirSync(CERT_DIR, { recursive: true });
  const san = ['DNS:localhost', 'IP:127.0.0.1', ...addresses.map((address) => `IP:${address}`)].join(',');

  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '365',
    '-keyout', keyPath, '-out', certPath,
    '-subj', '/CN=suona-la-nota',
    '-addext', `subjectAltName=${san}`,
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  writeFileSync(join(CERT_DIR, 'README'), `Certificate valid for: ${san}\nDelete this directory to regenerate it.\n`);
  return { keyPath, certPath };
}

function resolveRequestPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  const relative = normalize(decoded).replace(/^([/\\])+/, '');
  let target = resolve(ROOT, relative);
  if (!target.startsWith(ROOT + sep) && target !== ROOT) return null;

  if (statSync(target, { throwIfNoEntry: false })?.isDirectory()) target = join(target, 'index.html');
  if (!existsSync(target)) return null;
  return target;
}

const addresses = localAddresses();
const { keyPath, certPath } = ensureCertificate(addresses);

const server = createServer(
  { key: readFileSync(keyPath), cert: readFileSync(certPath) },
  (request, response) => {
  const target = resolveRequestPath(request.url ?? '/');
  if (target === null) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('non trovato\n');
    return;
  }
  response.writeHead(200, { 'content-type': MIME.get(extname(target)) ?? 'application/octet-stream' });
  createReadStream(target).pipe(response);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\nLa porta ${PORT} è già occupata.`);
    console.error('Quasi sempre è un\'altra istanza di questo server rimasta accesa:');
    console.error(`  ss -ltnp | grep :${PORT}      # per vedere il pid`);
    console.error('  kill <pid>                    # per chiuderla');
    console.error(`Oppure usa un'altra porta:  PORT=8444 just serve-tls\n`);
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, '0.0.0.0', () => {
  const page = `https://localhost:${PORT}/`;
  console.log(`\nsuona-la-nota · l'applicazione è servita in HTTPS`);
  console.log(`va aperta con https://, non con http://: su questa porta http non risponde\n`);
  for (const address of addresses) {
    console.log(`  dal telefono:  https://${address}:${PORT}/`);
  }
  console.log(`  da questa macchina:  ${page}`);
  console.log(`\nIl browser avviserà che il certificato non è firmato: accettalo una volta.`);
  console.log('Ctrl-C per fermarlo.');

  // The page is opened for whoever asked for a server, once it is actually
  // listening; `OPEN=0` keeps it quiet (the smoke check, a script).
  if (process.env.OPEN !== '0') {
    const opener = spawn('xdg-open', [page], { stdio: 'ignore', detached: true });
    opener.on('error', () => console.log(`\napri tu: ${page}`));
    opener.unref();
  }
});
