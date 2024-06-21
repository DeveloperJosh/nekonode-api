import express from 'express';
import router from './routes/gogo.js';
import dotenv from 'dotenv';
import onFinished from 'on-finished';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware to log requests and responses
app.use((req, res, next) => {
    // Log request details
    console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.originalUrl}`);

    // Hook into the response lifecycle
    onFinished(res, (err, res) => {
        if (err) {
            console.error('Error during response:', err);
        } else {
            console.log(`[${new Date().toLocaleString()}] ${res.statusCode} ${res.statusMessage}`);
        }
    });

    next();
});

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to NekoNode API' });
});

app.use('/api', router);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
