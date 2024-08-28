const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const mysql = require('mysql2/promise'); // Menggunakan mysql2 untuk dukungan Promise
const SearchValidator = require('./scrape.js'); // Pastikan file ini ada dan berfungsi
require('dotenv').config();

const app = express();

// Konfigurasi EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views')); // Pastikan path ini benar sesuai dengan struktur proyek

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Pastikan secure: false jika tidak menggunakan HTTPS dalam pengembangan
}));

// Buat pool koneksi ke MySQL
const pool = mysql.createPool({
  host: 'bt8d8ug5hpoxdwsukll6-mysql.services.clever-cloud.com',
  user: 'utrs1etdedrsx5og',
  password: 'nGaXw8vAZUlBJgzNpdQw',
  database: 'bt8d8ug5hpoxdwsukll6',
  waitForConnections: true,
  connectionLimit: 10, // Jumlah maksimum koneksi yang dapat dibuat oleh pool
  queueLimit: 3 // Jumlah maksimum permintaan yang menunggu koneksi
});

// Endpoint POST untuk pencariannnn
app.post('/search', async (req, res) => {
  try {
    const { pubkey } = req.body;
    console.log('Received pubkey:', pubkey);

    // Pastikan pubkey valid sebelum melanjutkan
    if (!pubkey) {
      return res.status(400).send('Pubkey is required');
    }

    await SearchValidator(pubkey);
     // Redirect ke / dengan pubkey sebagai query parameter
    res.redirect(`/?pubkey=${encodeURIComponent(pubkey)}`);
  } catch (error) {
    console.error('Error searching validator:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint GET untuk halaman utama
app.get('/', async (req, res) => {
  const pubkey = req.query.pubkey; // Ambil pubkey dari query parameter
  console.log('Pubkey from query in /:', pubkey);
  


  try {
    // if (!pubkey) {
    //   return res.status(400).send('Pubkey is required');
    // }else{
    //   res.redirect(`/?pubkey=${encodeURIComponent(pubkey)}`);

    // }

    const [rows] = await pool.query('SELECT * FROM validator WHERE pubkey = ?', [pubkey]);
    const users = JSON.parse(JSON.stringify(rows));

    if (users.length === 0) {
      console.log('No records found for pubkey:', pubkey);
    } else {
      console.log('Users found:', users);
    }

    // Check balance changes
    let status = 'Not Available'; // Default status if no data available
    if (users.length > 0) {
      const balance = users[0].balance;
      const lastBalance = users[0].last_balance;

      if (balance > lastBalance) {
        status = 'Increased';
      } else if (balance < lastBalance) {
        status = 'Decreased';
      } else {
        status = 'No Change';
      }
    }
    // res.redirect(`/?pubkey=${encodeURIComponent(pubkey)}`);
    res.render('index', { validators: users, status: status });
  } catch (error) {
    console.error('Error fetching validators:', error);
    res.status(500).send('Internal Server Error');
  }
  
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
