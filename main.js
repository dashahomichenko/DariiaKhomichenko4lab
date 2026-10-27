import http from 'node:http';
import fs from 'node:fs';
import { program } from 'commander';

program.helpOption('--help', 'Вивести довідку');

program
  .option('-i, --input <path>', 'шлях до файлу даних')
  .option('-h, --host <address>', 'адреса сервера')
  .option('-p, --port <number>', 'порт сервера')
  .option('-o, --output <path>', 'файл для запису останньої відповіді');

program.parse(process.argv);
const options = program.opts();