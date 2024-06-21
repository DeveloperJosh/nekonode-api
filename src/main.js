import express from 'express';
import router from './routes/gogo.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    // send 200 status code
    req.status(200).json({ message: 'Welcome to the NekoNode API' });
});

app.use('/api', router);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
