import express from 'express';
import router from './routes/gogo.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use('/api', router);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
