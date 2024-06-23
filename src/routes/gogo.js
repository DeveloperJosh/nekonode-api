import { Router } from 'express';
import axios from 'axios';
import { load } from 'cheerio';
import dotenv from 'dotenv';
import getEpisodeSources from '../extractor/gogocdn.js';

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
 *         url:
 *           type: string
 *           description: The URL to the anime page.
 *       required:
 *         - name
 *         - url
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
 *         description: No results found.
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
            const url = animeElement.find('a').attr('href');

            animeMatches.push({ name, url: `${baseUrl}${url}` });
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
 *       500:
 *         description: Failed to retrieve episode sources.
 */
router.get('/watch/:episode', async (req, res) => {
    const episode = req.params.episode;

    try {
        const episodeSources = await getEpisodeSources(episode);
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
 *         name: anime
 *         required: true
 *         schema:
 *           type: string
 *         description: The anime identifier (e.g., anime-name).
 *     responses:
 *       200:
 *         description: The detailed information of the anime.
 *       500:
 *         description: Failed to retrieve anime info.
 */
router.get('/info/:animeName', async (req, res) => {
    let anime = req.params.animeName;
    // make the animeName URL friendly so if they search for "One Piece" it will be "one-piece"
    anime = anime.replace(/\s+/g, '-').toLowerCase();

    try {
        const animeResponse = await axios.get(`${baseUrl}/category/${anime}`);
        const $ = load(animeResponse.data);
        let animeInfo = {};

        const title = $('.anime_info_body_bg h1').text().trim() || 'Unknown Title';
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
            title, 
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

export default router;
