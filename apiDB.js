const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'rahasia-super-aman-123';

function cekLogin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ pesan: 'Token tidak ditemukan' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ pesan: 'Token tidak valid' });
        }
        req.user = user;
        next();
    });
}

app.get('/produk', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM produk');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/produk', async (req, res) => {
    try {
        const { nama, harga, stok } = req.body;
        const result = await pool.query(
            'INSERT INTO produk (nama, harga, stok) VALUES ($1, $2, $3) RETURNING *',
            [nama, harga, stok]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/keranjang', cekLogin, async (req, res) => {
    try {
        const { produk_id, jumlah } = req.body;
        const user_id = req.user.id;
        const result = await pool.query(
            'INSERT INTO keranjang (user_id, produk_id, jumlah) VALUES ($1, $2, $3) RETURNING *',
            [user_id, produk_id, jumlah]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/booking', cekLogin, async (req, res) => {
    try {
        const { nama_kegiatan, tanggal, jam_mulai, jam_selesai } = req.body;
        const user_id = req.user.id;

        const cekBentrok = await pool.query(
            `SELECT * FROM booking WHERE tanggal = $1
            AND (jam_mulai < $3 AND jam_selesai > $2)`,
            [tanggal, jam_mulai, jam_selesai]
        );

        if (cekBentrok.rows.length > 0) {
            return res.status(409).json({ pesan: 'Jadwal bentrok, pilih waktu lain '});
        }

        const result = await pool.query(
            'INSERT INTO booking (user_id, nama_kegiatan, tanggal, jam_mulai, jam_selesai) VALUES ( $1, $2, $3, $4, $5) RETURNING *',
            [user_id, nama_kegiatan, tanggal, jam_mulai, jam_selesai]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/booking', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM booking');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
            [email, hashedPassword]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ pesan: 'Email tidak ditemukan' });
        }

        const cocok = await bcrypt.compare(password, user.password);
        if (!cocok) {
            return res.status(401).json({ pesan: 'Password salah' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ pesan: 'Login berhasil', token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/pengeluaran', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM pengeluaran');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/pengeluaran', async (req, res) => {
    try {
        const { nama, jumlah } = req.body;
        const result = await pool.query(
            'INSERT INTO pengeluaran (nama, jumlah) VALUES ($1, $2) RETURNING *',
            [nama, jumlah]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/pengeluaran/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nama, jumlah } = req.body;
        const result = await pool.query(
            'UPDATE pengeluaran SET nama = $1, jumlah = $2 WHERE id = $3 RETURNING *',
            [nama, jumlah, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ pesan: 'Data tidak ditemukan' })
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/pengeluaran/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM pengeluaran WHERE id = $1', [id]);
        res.json({ pesan: 'Data berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => {
    console.log('Server + PostgreSQL jalan di http://localhost:3000');
});