import { Router } from 'express';
import axios from 'axios';
import { load } from 'cheerio';
import dotenv from 'dotenv';
import getEpisodeSources from '../extractor/gogocdn.js';
import EpisodeSources from '../schemas/EpisodeSources.js';
import AnimeMatch from '../schemas/AnimeMatch.js';
import AnimeInfo from '../schemas/AnimeInfo.js';
import puppeteer from 'puppeteer';

dotenv.config();

const router = Router();
const baseUrl = process.env.BASE_URL;

/**
 * @swagger
 * components:
 *   schemas:
 *     AnimeMatch:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the anime.
 *           example: "Naruto"
 *         lang:
 *          type: string
 *          description: The language of the anime.
 *          example: "Sub"
 *         url:
 *           type: string
 *           description: The URL of the anime.
 *           example: "https://example.com/anime/naruto"
 *     EpisodeSources:
 *       type: object
 *       properties:
 *         source:
 *           type: string
 *           description: The source URL of the episode.
 *           example: "https://example.com/source.m8u3"
 *         quality:
 *           type: string
 *           description: The quality of the source (e.g., 720p, 1080p).
 *           example: "720p"
 *     AnimeInfo:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           description: The title of the anime.
 *           example: "One Piece"
 *         description:
 *           type: string
 *           description: The description of the anime.
 *           example: "A story about a pirate crew seeking the ultimate treasure."
 *         status:
 *           type: string
 *           description: The status of the anime (e.g., Ongoing, Completed).
 *           example: "Ongoing"
 *         genres:
 *           type: array
 *           items:
 *             type: string
 *           description: The genres of the anime.
 *           example: ["Action", "Adventure"]
 *         released:
 *           type: string
 *           description: The release date of the anime.
 *           example: "1999"
 *         totalEpisodes:
 *           type: integer
 *           description: The total number of episodes.
 *           example: 1000
 */

/**
 * @swagger
 * /api/search/{animeName}:
 *   get:
 *     summary: Searches for an anime by name.
 *     parameters:
 *       - in: path
 *         name: animeName
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the anime to search for.
 *     responses:
 *       200:
 *         description: An array of anime matches.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AnimeMatch'
 *       404:
 *         description: No results found. (You should know some anime names are in japanese)
 *       500:
 *         description: Failed to retrieve anime.
 */
router.get('/search/:animeName', async (req, res) => {
    const animeName = req.params.animeName;
    const encodedAnimeName = encodeURIComponent(animeName);

    try {
        const searchResponse = await axios.get(`${baseUrl}/search.html?keyword=${encodedAnimeName}`);
        const $ = load(searchResponse.data);
        let animeMatches = [];

        $('.items .img').each((_, element) => {
            const animeElement = $(element);
            const name = animeElement.find('a').attr('title').trim();
            // name has (dub in it) so we can use this to determine if it is subbed or dubbed
            const is_dub = name.includes('(Dub)') ? 'Dub' : 'Sub';
            const image = animeElement.find('img').attr('src');
            const url = animeElement.find('a').attr('href');

            let animeMatch = { ...AnimeMatch, name, lang: `${is_dub}`, image, url: `${baseUrl}${url}` };
            animeMatches.push(animeMatch);
        });

        if (animeMatches.length === 0) {
            res.status(404).json({ error: 'No results found' });
        } else {
            res.json(animeMatches);
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve anime' });
    }
});
/**
 * @swagger
 * /api/watch/{episode}:
 *   get:
 *     summary: Fetches the sources for the episode.
 *     parameters:
 *       - in: path
 *         name: episode
 *         required: true
 *         schema:
 *           type: string
 *         description: The episode identifier (e.g., anime-name-episode-1).
 *     responses:
 *       200:
 *         description: The episode sources.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EpisodeSources'
 *       500:
 *         description: Failed to retrieve episode sources.
 */
router.get('/watch/:episode', async (req, res) => {
    const episode = req.params.episode;

    try {
        const episodeSourceData = await getEpisodeSources(episode);
        let episodeSources = [];

        episodeSourceData.forEach(sourceData => {
            let episodeSource = { ...EpisodeSources, source: sourceData.url, quality: sourceData.quality };
            episodeSources.push(episodeSource);
        });

        res.json(episodeSources);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve episode sources' });
    }
});

/**
 * @swagger
 * /api/info/{animeName}:
 *   get:
 *     summary: Retrieves detailed information about an anime.
 *     parameters:
 *       - in: path
 *         name: animeName
 *         required: true
 *         schema:
 *           type: string
 *         description: The anime identifier (e.g., anime-name).
 *     responses:
 *       200:
 *         description: The detailed information of the anime.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnimeInfo'
 *       500:
 *         description: Failed to retrieve anime info.
 */
router.get('/info/:animeName', async (req, res) => {
    let anime = req.params.animeName;
    anime = anime.replace(/\s+/g, '-').toLowerCase();

    try {
        const animeResponse = await axios.get(`${baseUrl}/category/${anime}`);
        const $ = load(animeResponse.data);
        let animeInfo = { ...AnimeInfo }; // Initialize with default schema structure

        const title = $('.anime_info_body_bg h1').text().trim() || 'Unknown Title';
        const image = $('.anime_info_body_bg img').attr('src') || 'No Image Available';
        const description = $('.description').text().trim() || 'No description available.';
        const status = $('span:contains("Status:")').parent().find('a').text().trim() || 'Unknown Status';

        const genres = [];
        $('span:contains("Genre:")').parent().find('a').each((_, element) => {
            const genre = $(element).text().replace(/^,/, '').trim();
            genres.push(genre);
        });

        const cleanGenres = genres.filter(genre => genre);

        const released = $('span:contains("Released:")').parent().text().replace('Released:', '').trim() || 'Unknown Release Date';

        const epEndAttribute = $('#episode_page a').last().attr('ep_end');
        const totalEpisodes = epEndAttribute ? parseInt(epEndAttribute, 10) : 'Not Available';

        animeInfo = { 
            ...animeInfo,
            title, 
            image,
            description, 
            status, 
            genres: cleanGenres, 
            released, 
            totalEpisodes 
        };

        res.json(animeInfo);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve anime info' });
    }
});

/**
 * @swagger
 * /api/episodes/{animeName}:
 *   get:
 *     summary: Retrieves the list of episodes for a specific anime.
 *     parameters:
 *       - in: path
 *         name: animeName
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the anime.
 *     responses:
 *       200:
 *         description: A list of episodes for the specified anime, This endpoint is really slow i wouldn't use it.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   episodeNumber:
 *                     type: string
 *                     description: The episode number.
 *                   episodeTitle:
 *                     type: string
 *                     description: The title of the episode.
 *                   episodeUrl:
 *                     type: string
 *                     description: The URL to watch the episode.
 *       404:
 *         description: No episodes found.
 *       500:
 *         description: Failed to retrieve episodes.
 */
router.get('/episodes/:animeName', async (req, res) => {
    // slow as hell don't use
    const animeName = req.params.animeName.replace(/\s+/g, '-').toLowerCase();

    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Reduce security overhead
        });
        const page = await browser.newPage();

        // Block unnecessary resources to speed up loading
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // Navigate to the anime page and wait for the essential content to load
        await page.goto(`${baseUrl}/category/${animeName}`, { waitUntil: 'domcontentloaded' });

        // Wait for the element that contains episodes
        await page.waitForSelector('#load_ep #episode_related li a', { timeout: 5000 }); // Adjust timeout as needed

        // Extract the HTML content
        const content = await page.content();
        await browser.close();

        // Load the content into Cheerio for parsing
        const $ = load(content);

        const episodes = [];
        $('#load_ep #episode_related li a').each((index, element) => {
            const episodeElement = $(element);
            const episodeNumber = episodeElement.find('.name span').text().replace('EP', '').trim();
            const episodeTitle = episodeElement.find('.name').text().trim();
            const episodeUrl = `${baseUrl}${episodeElement.attr('href').trim()}`;

            episodes.push({ episodeNumber, episodeTitle, episodeUrl });
        });

        if (episodes.length === 0) {
            res.status(404).json({ error: 'No episodes found' });
        } else {
            res.json(episodes);
        }
    } catch (error) {
        console.error('Error retrieving episodes:', error);
        res.status(500).json({ error: 'Failed to retrieve episodes' });
    }
});

/**
 * @swagger
 * /api/latest:
 *  get:
 *   summary: Retrieves the latest episodes.
 *  responses:
 *   200:
 *   description: The latest episodes.
 *  content:
 *  application/json:
 *  schema:
 *  type: array
 * items:
 * $ref: '#/components/schemas/AnimeMatch'
 * 500:
 * description: Failed to retrieve latest episodes.
 */
router.get('/latest', (req, res) => {
    // get last_episodes loaddub

    axios.get(`${baseUrl}/`).then((response) => {
        const $ = load(response.data);
        let latestEpisodes = [];

        $('.items .img').each((_, element) => {
            const animeElement = $(element);
            const name = animeElement.find('a').attr('title').trim();
            const image = animeElement.find('img').attr('src');
            const url = animeElement.find('a').attr('href');
            const lang = name.includes('(Dub)') ? 'Dub' : 'Sub';

            let animeMatch = { ...AnimeMatch, name, lang, image, url: `${baseUrl}${url}` };
            latestEpisodes.push(animeMatch);
        });

        res.json(latestEpisodes);
    }).catch((error) => {
        res.status(500).json({ error: 'Failed to retrieve latest episodes' });
    });
});

export default router;
