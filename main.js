import http from 'node:http';
import fs from 'node:fs';
import { program } from 'commander';

program
  .helpOption('--help', 'Вивести довідку')
  .requiredOption('-i, --input <path>', 'шлях до файлу даних')
  .requiredOption('-h, --host <address>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .option('-o, --output <path>', 'файл для запису останньої відповіді');

program.parse(process.argv);
const options = program.opts();

const portNumber = Number(options.port);
if (Number.isNaN(portNumber) || portNumber <= 0 || portNumber > 65535) {
  console.error('Помилка: Порт має бути коректним числом!');
  process.exit(1);
}

function sendJsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  res.end(body);
}

fs.access(options.input, fs.constants.F_OK, (accessErr) => {
  if (accessErr) {
    console.error('Cannot find input file');
    process.exit(1);
  }
  fs.access(options.input, fs.constants.F_OK, (accessErr) => {
  if (accessErr) {
    console.error('Cannot find input file');
    process.exit(1);
    
  }

  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || options.host}`);

    if (parsedUrl.pathname !== '/') {
      sendJsonResponse(res, 404, {
        error: 'Маршрут не знайдено. Використовуйте кореневий шлях /'
      });
      return;
    }