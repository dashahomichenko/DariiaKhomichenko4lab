import http from 'node:http';
import fs from 'node:fs';
import { program } from 'commander';

// Налаштування опцій командного рядка (усуваємо конфлікт -h)
program
  .helpOption('--help', 'Показати довідку')
  .requiredOption('-i, --input <path>', 'шлях до вхідного JSON-файлу')
  .requiredOption('-h, --host <address>', 'адреса хоста сервера')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .option('-o, --output <path>', 'шлях до файлу для збереження останньої відповіді');

// Переклад помилок commander українською (як у нашій 3-й лабораторній)
program.configureOutput({
  outputError: (str, write) => {
    if (str.includes('required option')) {
      write('Помилка: Не вказано обовʼязкову опцію (-i, -h або -p)!\n');
    } else if (str.includes('argument missing')) {
      write('Помилка: Пропущено значення для опції!\n');
    } else {
      write(`Помилка аргументів командного рядка: ${str}`);
    }
  }
});

program.parse(process.argv);
const opts = program.opts();

// Допоміжна функція для відправки JSON-відповіді з потрібним заголовком і кодом
function replyWithJson(res, status, data) {
  const jsonString = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  res.end(jsonString);
}

// Перевірка існування файлу через колбек fs.stat перед запуском сервера
fs.stat(opts.input, (statErr) => {
  if (statErr) {
    console.error('Cannot find input file');
    process.exit(1);
  }

  const appServer = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://${opts.host}:${opts.port}`);

    // 1. Перевірка маршруту (дозволено лише /)
    if (requestUrl.pathname !== '/') {
      replyWithJson(res, 404, {
        message: 'Помилка 404: Сторінку не знайдено. Звертайтеся за маршрутом /'
      });
      return;
    }

    // 2. Отримання та перевірка параметрів запиту (Варіант 8)
    const params = requestUrl.searchParams;
    const includePayment = params.get('payment') === 'true';
    const minValParam = params.get('min_value');
    const isMinProvided = minValParam !== null;
    const minLimit = isMinProvided ? Number(minValParam) : null;

    if (isMinProvided && (minValParam.trim() === '' || Number.isNaN(minLimit))) {
      replyWithJson(res, 400, {
        message: 'Помилка 400: Параметр min_value повинен бути числом'
      });
      return;
    }

    // 3. Асинхронне читання файлу даних на кожен запит
    fs.readFile(opts.input, 'utf-8', (readErr, rawText) => {
      if (readErr) {
        replyWithJson(res, 500, {
          message: 'Помилка 500: Не вдалося прочитати файл даних'
        });
        return;
      }

      let bookingsList;
      try {
        bookingsList = JSON.parse(rawText);
        if (!Array.isArray(bookingsList)) {
          replyWithJson(res, 500, {
            message: 'Помилка 500: Вхідні дані не є JSON-масивом'
          });
          return;
        }
      } catch {
        replyWithJson(res, 500, {
          message: 'Помилка 500: Некоректний формат JSON у файлі даних'
        });
        return;
      }

      // 4. Фільтрація та формування об'єктів за допомогою .filter() і .map()
      const processedBookings = bookingsList
        .filter((row) => {
          if (!row || typeof row !== 'object') return false;
          const val =
            row.Booking_Value === null || row.Booking_Value === undefined || row.Booking_Value === ''
              ? 0
              : Number(row.Booking_Value);

          if (Number.isNaN(val)) return false;
          return isMinProvided ? val > minLimit : true;
        })
        .map((row) => {
          const numVal =
            row.Booking_Value === null || row.Booking_Value === undefined || row.Booking_Value === ''
              ? 0
              : Number(row.Booking_Value);

          const bookingObj = {
            booking_id: row.Booking_ID ?? '',
            vehicle_type: row.Vehicle_Type ?? '',
            booking_value: numVal
          };

          if (includePayment) {
            bookingObj.payment_method = row.Payment_Method ?? '';
          }

          return bookingObj;
        });

      // 5. Запис у вихідний файл (якщо задано --output) та відправка відповіді
      if (opts.output) {
        const outputText = JSON.stringify(processedBookings, null, 2);
        fs.writeFile(opts.output, outputText, 'utf-8', (writeErr) => {
          if (writeErr) {
            replyWithJson(res, 500, {
              message: 'Помилка 500: Не вдалося записати відповідь у вихідний файл'
            });
            return;
          }
          replyWithJson(res, 200, processedBookings);
        });
      } else {
        replyWithJson(res, 200, processedBookings);
      }
    });
  });

  appServer.listen(Number(opts.port), opts.host, () => {
    console.log(`Сервер працює на http://${opts.host}:${opts.port}/`);
  });
});