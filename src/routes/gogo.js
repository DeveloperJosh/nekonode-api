import { Router } from 'express';
import axios from 'axios';
import { load } from 'cheerio';
import dotenv from 'dotenv';
///import getEpisodeSources from '../extractor/gogocdn.js';
import GogoCDN from '../extractor/gogocdn.js';
import EpisodeSources from '../schemas/EpisodeSources.js';
import AnimeMatch from '../schemas/AnimeMatch.js';
import AnimeInfo from '../schemas/AnimeInfo.js';
dotenv.config();

const router = Router();
const baseUrl = process.env.BASE_URL;
const list = [];
const gogoCDN = new GogoCDN();

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
 *         encodedName:
 *          type: string
 *          description: The name of the anime encoded.
 *          example: "the-irregular-at-magic-high-school"
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
    const page = req.query.page || 1; // Default to page 1 if no page is specified

    try {
        const searchResponse = await axios.get(`${baseUrl}/search.html?keyword=${encodedAnimeName}&page=${page}`);
        const $ = load(searchResponse.data);
        let animeMatches = [];

        $('.items .img').each((_, element) => {
            const animeElement = $(element);
            const name = animeElement.find('a').attr('title').trim();
            const is_dub = name.includes('(Dub)') ? 'Dub' : 'Sub';
            const image = animeElement.find('img').attr('src');
            const url = animeElement.find('a').attr('href');
            let encodedName = name.replace(/\s+/g, '-').toLowerCase();
            encodedName = encodedName.replace(/[^a-zA-Z0-9-]/g, '');

            let animeMatch = { name, encodedName, lang: `${is_dub}`, image, url: `${baseUrl}${url}` };
            animeMatches.push(animeMatch);
        });

        const nextPage = $('div.anime_name_pagination.intro a[data-page]').last().attr('href');
        const hasNextPage = nextPage && nextPage !== `?page=${page}`;

        if (animeMatches.length === 0) {
            res.status(404).json({ error: 'No results found' });
        } else {
            res.json({
                animeMatches,
                nextPage: hasNextPage ? parseInt(page) + 1 : null
            });
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
        const episodeSourceData = await gogoCDN.getEpisodeSources(episode);
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
    anime = anime.replace(/:/g, '');

    const encodedAnime = encodeURIComponent(anime);

    try {
        const animeResponse = await axios.get(`${baseUrl}/category/${encodedAnime}`);
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
router.get('/latest', async (req, res) => {
    try {
        const page = req.query.page || 1; // Default to page 1 if no page is specified
        const includeNextPage = req.query.next === 'true'; // Check if next page is requested

        const fetchEpisodes = async (url) => {
            const response = await axios.get(url);
            const $ = load(response.data);
            let episodes = [];

            $('.items .img').each((_, element) => {
                const animeElement = $(element);
                let name = animeElement.find('a').attr('title').trim();
                const image = animeElement.find('img').attr('src');
                const url = animeElement.find('a').attr('href');
                const lang = name.includes('(Dub)') ? 'Dub' : 'Sub';
                let encodedName = name.replace(/\s+/g, '-').toLowerCase();
                encodedName = encodedName.replace(/[^a-zA-Z0-9-]/g, '');

                let animeMatch = { name, encodedName, lang, image, url: `${baseUrl}${url}` };
                episodes.push(animeMatch);
            });

            const nextPage = $('div.anime_name_pagination.intro a[data-page]').last().attr('href');
            return { episodes, nextPage };
        };

        const { episodes: latestEpisodes, nextPage } = await fetchEpisodes(`${baseUrl}/?page=${page}`);
        
        let allEpisodes = [...latestEpisodes];
        if (includeNextPage && nextPage && nextPage !== `?page=${page}`) {
            const nextPageNumber = nextPage.match(/\?page=(\d+)/)[1];
            if (nextPageNumber > page) {
                const { episodes: nextPageEpisodes } = await fetchEpisodes(`${baseUrl}${nextPage}`);
                allEpisodes = [...allEpisodes, ...nextPageEpisodes];
            }
        }

        res.json(allEpisodes);
    } catch (error) {
        console.error('Error fetching episodes:', error); // Debugging log
        res.status(500).json({ error: 'Failed to retrieve latest episodes' });
    }
});

/**
 * @swagger
 * /api/anime/{animeName}:
 *   get:
 *     summary: Retrieves detailed information about an anime along with its episodes.
 *     parameters:
 *       - in: path
 *         name: animeName
 *         required: true
 *         schema:
 *           type: string
 *         description: The identifier for the anime.
 *     responses:
 *       200:
 *         description: The detailed information of the anime along with its episodes.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 animeInfo:
 *                   $ref: '#/components/schemas/AnimeInfo'
 *                 episodes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       episodeNumber:
 *                         type: integer
 *                         description: The episode number.
 *                         example: 1
 *                       title:
 *                         type: string
 *                         description: The title of the episode.
 *                         example: "Adventure on the High Seas"
 *                       url:
 *                         type: string
 *                         description: URL to watch the episode.
 *                         example: "https://gogoanime3.co/adventure-high-seas-episode-1"
 *       404:
 *         description: No episodes found or movie ID not available.
 *       500:
 *         description: Server error or failed to retrieve data from the external API.
 */
router.get('/anime/:animeName', async (req, res) => {
    let animeName = req.params.animeName;
    let encodedAnimeName = encodeURIComponent(animeName);
    try {
        // Fetch the main page for the anime
        const response = await axios.get(`${baseUrl}/category/${encodedAnimeName}`);
        const $ = load(response.data);

        // Extract the movie ID
        const movieId = $('input#movie_id').val();
        if (!movieId) {
            console.error('Movie ID not found.');
            return res.status(404).json({ error: 'Movie ID not found' });
        }

        // Fetch the episode list from the Gogoanime API
        const apiUrl = "https://ajax.gogocdn.net/ajax/load-list-episode";
        const params = {
            ep_start: 0,
            ep_end: 9999,
            id: movieId,
        };
        const apiResponse = await axios.get(apiUrl, { params });

        // Check if API response is valid
        if (!apiResponse.data) {
            console.log('No episodes found.');
            return res.status(404).json({ error: 'No episodes found' });
        }

        // Load the HTML from the API response
        const $api = load(apiResponse.data);

        // Extract episodes from the API response
        const episodes = [];
        $api('li').each((i, element) => {
            const episodeUrl = $api(element).find('a').attr('href');
            const episodeTitle = $api(element).find('.name').text().trim();
            const episodeNumberMatch = episodeTitle.match(/Episode (\d+)/);
            const episodeNumber = episodeNumberMatch ? parseInt(episodeNumberMatch[1], 10) : i + 1;

            if (episodeUrl && episodeTitle) {
                episodes.push({
                    episodeNumber: episodeNumber,
                    title: episodeTitle,
                    url: `https://gogoanime3.co${episodeUrl.trim()}`,
                });
            }
        });

        episodes.forEach(episode => {
            const match = episode.title.match(/\bEP (\d+)\b/);
            if (match) {
              episode.episodeNumber = parseInt(match[1], 10);
            }
        });

        episodes.reverse();

        // Extract anime information
        let anime = req.params.animeName;
        anime = anime.replace(/\s+/g, '-').toLowerCase();
        anime = anime.replace(/:/g, '');
        const encodedAnime = encodeURIComponent(anime);

        const animeResponse = await axios.get(`${baseUrl}/category/${encodedAnime}`);
        const animePage = load(animeResponse.data);
        let animeInfo = { ...AnimeInfo }; // Initialize with default schema structure

        const title = animePage('.anime_info_body_bg h1').text().trim() || 'Unknown Title';
        const image = animePage('.anime_info_body_bg img').attr('src') || 'No Image Available';
        const description = animePage('.description').text().trim() || 'No description available.';
        const status = animePage('span:contains("Status:")').parent().find('a').text().trim() || 'Unknown Status';

        const genres = [];
        animePage('span:contains("Genre:")').parent().find('a').each((_, element) => {
            const genre = $(element).text().replace(/^,/, '').trim();
            genres.push(genre);
        });

        const cleanGenres = genres.filter(genre => genre);

        const released = animePage('span:contains("Released:")').parent().text().replace('Released:', '').trim() || 'Unknown Release Date';

        const epEndAttribute = animePage('#episode_page a').last().attr('ep_end');
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

        // Respond with combined data
        res.json({
            animeInfo,
            episodes
        });
    } catch (error) {
        console.error('Failed to retrieve anime:', error);
        res.status(500).json({ error: 'Failed to retrieve anime' });
    }
});


export default router;
