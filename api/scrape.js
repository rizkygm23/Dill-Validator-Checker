const chromium = require('chrome-aws-lambda');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Buat koneksi ke MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

const SearchValidator = async (pubkey) => {
  let browser = null;
  try {
    // Cek apakah pubkey sudah ada di database
    const [rows] = await pool.query('SELECT * FROM validator WHERE pubkey = ?', [pubkey]);
    const oldData = rows[0];

    browser = await chromium.puppeteer.launch({
      args: ['--no-sandbox',
              '--disable-setuid-sandbox',
              ...chromium.args
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreDefaultArgs: ['--disable-extensions']
    });

    const page = await browser.newPage();

    // Navigasi ke halaman yang diinginkan dengan pubkey
    await page.goto(`https://andes.dill.xyz/validators?p=50&ps=25&pubkey=${pubkey}`);
    console.log('Navigated to page');

    // Tunggu hingga elemen balance tersedia di halaman
    await page.waitForSelector('.MuiGrid-root.MuiGrid-item.MuiGrid-grid-xs-1.css-1doag2i');
    console.log('Element found');

    // Ambil nilai balance dari halaman
    const balanceValue = await page.evaluate(() => {
      const elements = document.querySelectorAll('h6');
      let balanceText = null;

      elements.forEach(element => {
        if (element.textContent.includes('Balance')) {
          const balanceElement = element.nextElementSibling;
          if (balanceElement) {
            balanceText = balanceElement.textContent.trim();
          }
        }
      });

      const balanceNumber = balanceText.match(/[\d,]+(\.\d+)?/);
      return balanceNumber ? balanceNumber[0].replace(/,/g, '') : null;
    });
    console.log('Balance value:', balanceValue);

    await browser.close();

    if (balanceValue) {
      if (oldData) {
        // Jika pubkey sudah ada di database, update balance dan last_balance
        await pool.query('UPDATE validator SET last_balance = balance, balance = ? WHERE pubkey = ?', [balanceValue, pubkey]);
      } else {
        // Jika pubkey belum ada di database, masukkan data baru
        await pool.query('INSERT INTO validator (pubkey, balance, last_balance) VALUES (?, ?, ?)', [pubkey, balanceValue, balanceValue]);
      }

      // Return data untuk ditampilkan di web
      return {
        pubkey: pubkey,
        balance: balanceValue,
        balanceChanged: oldData && oldData.balance !== balanceValue
      };
    } else {
      throw new Error('Failed to retrieve balance.');
    }
  } catch (error) {
    console.error('SearchValidator error:', error);
    throw error; // Rethrow untuk ditangani oleh handler di server.js
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = SearchValidator;
