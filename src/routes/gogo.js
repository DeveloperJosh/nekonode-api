import { Router } from 'express';
import axios from 'axios';
import { load } from 'cheerio';
import dotenv from 'dotenv';
import getEpisodeSources from '../extractor/gogocdn.js';

dotenv.config();

const router = Router();
const baseUrl = process.env.BASE_URL;

router.get('/:animeName', async (req, res) => {
    const animeName = req.params.animeName;
    const encodedAnimeName = encodeURIComponent(animeName);

    try {
        const searchResponse = await axios.get(`${baseUrl}search.html?keyword=${encodedAnimeName}`);
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

router.get('/watch/:episode', async (req, res) => {
    // watch/remonster-episode-2
    const episode = req.params.episode;

    try {
       // console.log(`DEBUG: Fetching episode sources for ${animeName} episode ${episodeNumber}`);
        const episodeSources = await getEpisodeSources(episode);
        res.json(episodeSources);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve episode sources' });
    }
});

router.get('/info/:anime', async (req, res) => {
    const anime = req.params.anime;

    try {
        const animeResponse = await axios.get(`${baseUrl}category/${anime}`);
        const $ = load(animeResponse.data);
        let animeInfo = {};

        // Extracting title
        const title = $('.anime_info_body_bg h1').text().trim();

        // Extracting description
        const description = $('.description').text().trim();

        // Extracting status
        const status = $('span:contains("Status:")').parent().find('a').text().trim();

        // Extracting genres
        const genres = [];
        $('span:contains("Genre:")').parent().find('a').each((_, element) => {
            genres.push($(element).text().trim());
        });

        // Extracting release year
        const released = $('span:contains("Released:")').parent().text().replace('Released:', '').trim();

        animeInfo = { title, description, status, genres, released };
        res.json(animeInfo);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve anime info' });
    }
});

export default router;
