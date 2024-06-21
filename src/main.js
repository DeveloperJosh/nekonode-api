import express from 'express';
import router from './routes/gogo.js';
import rateLimit from './utils/ratelimit.js';
import dotenv from 'dotenv';
import pino from 'pino';
import pinoHttp from 'pino-http';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Create a Pino logger
const logger = pino({
    level: 'info',
    base: { pid: process.pid },
    timestamp: pino.stdTimeFunctions.epochTime
});

// Use Pino HTTP middleware to log requests and responses
app.use(pinoHttp({
    logger: logger,
    serializers: {
        req(req) {
            return {
                method: req.method,
                url: req.url,
                hostname: req.hostname,
            };
        },
        res(res) {
            return {
                statusCode: res.statusCode
            };
        }
    }
}));

// Rate limit requests
app.use(rateLimit);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to NekoNode API' });
});

app.use('/api', router);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
