import NodeCache from 'node-cache';

const cache = new NodeCache();

const rateLimit = (req, res, next) => {
    const reqLimit = 100;
    const timeWindow = 60 * 1000; // 1 minute in milliseconds

    const ip = req.ip;
    const currentTime = Date.now();
    const currentRequests = cache.get(ip) || [];
    const validRequests = currentRequests.filter(time => currentTime - time < timeWindow);

    const remainingRequests = reqLimit - validRequests.length;
    const resetTime = validRequests.length > 0 ? validRequests[0] + timeWindow : currentTime + timeWindow;

    res.setHeader('X-RateLimit-Limit', reqLimit);
    res.setHeader('X-RateLimit-Remaining', String(remainingRequests));
    res.setHeader('X-RateLimit-Reset', Math.floor(resetTime / 1000));

    if (validRequests.length >= reqLimit) {
        return res.status(429).json({ message: 'Too many requests, please try again later.' });
    }

    validRequests.push(currentTime);
    cache.set(ip, validRequests, timeWindow / 1000); // cache expiration in seconds

    next();
};

export default rateLimit;
