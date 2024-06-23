import express from 'express';
import router from './routes/gogo.js';
import rateLimit from './utils/ratelimit.js';
import dotenv from 'dotenv';
import cors from 'cors';
import pino from 'pino';
import pinoHttp from 'pino-http';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const allowedOrigins = [
    'http://localhost:3000',
    `https://${host}`,
    `https://api.nekonode.net`, // Add your domain to allowed origins
];

const corsOptions = {
    origin: function (origin, callback) {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};

app.use(cors(corsOptions));

const logger = pino({
    level: 'info',
    base: { pid: process.pid },
    timestamp: pino.stdTimeFunctions.epochTime
});

app.use(pinoHttp({
    logger: logger,
    serializers: {
        req(req) {
            return {
                method: req.method,
                url: req.url,
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
    res.json({ message: 'Welcome to NekoNode API', docs: 'https://api.nekonode.net/docs' });
});

app.use('/api', router);

// Swagger setup
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'NekoNode API',
            version: '1.0.0',
            description: 'API for searching and retrieving anime details',
        },
        servers: [
            {
                url: `https://api.nekonode.net`,
                //url: `http://localhost:${port}`, // local development domain
            },
        ],
    },
    apis: [path.join(__dirname, 'routes', '*.js')],
};

const specs = swaggerJsdoc(options);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs));

app.listen(port, () => {
    console.log(`Server running on http://${host}:${port}`);
});

process.on('SIGINT', () => {
    console.log('Shutting down server');
    process.exit(0);
});
