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

    const showPayment = parsedUrl.searchParams.get('payment') === 'true';
    const hasMinValue = parsedUrl.searchParams.has('min_value');
    let minValue = null;

    if (hasMinValue) {
      const rawMin = parsedUrl.searchParams.get('min_value');
      minValue = Number(rawMin);
      if (rawMin.trim() === '' || Number.isNaN(minValue)) {
        sendJsonResponse(res, 400, {
          error: 'Параметр min_value має бути коректним числом'
        });
        return;
      }
    }

    fs.readFile(options.input, 'utf-8', (readErr, fileData) => {
      if (readErr) {
        sendJsonResponse(res, 500, {
          error: 'Помилка читання файлу даних на сервері'
        });
        return;
      }

      let records;
      try {
        records = JSON.parse(fileData);
        if (!Array.isArray(records)) {
          sendJsonResponse(res, 500, {
            error: 'Файл даних має некоректну структуру (очікується JSON-масив)'
          });
          return;
        }
      } catch {
        sendJsonResponse(res, 500, {
          error: 'Файл даних пошкоджено (синтаксична помилка JSON)'
        });
        return;
      }

      const result = [];
      for (const item of records) {
        if (!item || typeof item !== 'object') continue;

        const rawBookingVal = item.Booking_Value;
        const numBookingVal =
          rawBookingVal === null || rawBookingVal === undefined || rawBookingVal === ''
            ? 0
            : Number(rawBookingVal);

        if (Number.isNaN(numBookingVal)) continue;
        if (hasMinValue && !(numBookingVal > minValue)) continue;

        const formattedItem = {
          booking_id: item.Booking_ID ?? '',
          vehicle_type: item.Vehicle_Type ?? '',
          booking_value: numBookingVal
        };

        if (showPayment) {
          formattedItem.payment_method = item.Payment_Method ?? '';
        }

        result.push(formattedItem);
      }