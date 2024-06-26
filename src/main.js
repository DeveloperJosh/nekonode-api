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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:4000',
    'https://nekonode-site.sziwyz.easypanel.host',
    `https://api.nekonode.net`,
    `https://nekonode.net`
];

const corsOptions = {
    origin: function (origin, callback) {
        // Check if the origin is in the allowedOrigins array
        if (allowedOrigins.includes(origin) || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allow specific methods
    allowedHeaders: ['Content-Type', 'Authorization'] // Allow specific headers
};

// Enable CORS with the defined options
app.use(cors(corsOptions));

const logger = pino({
    level: 'info',
    base: { pid: process.pid },
    timestamp: pino.stdTimeFunctions.epochTime
});

// Rate limit requests
app.use(rateLimit);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger }));

// Define a route to render the index page
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
            },
        ],
    },
    apis: [path.join(__dirname, 'routes', '*.js')],
};

const specs = swaggerJsdoc(options);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs));

app.listen(port, () => {
    console.log(`Server running on ${host}:${port}`);
});