// Constants
const CLOUDCAST_API_URL = 'https://api.mixcloud.com/90milradio/cloudcasts/?limit=100';
const BATCH_SIZE = 10;
const RANDOM_COLORS = ['#011410', '#003d2f', '#c25d05'];

// DOM Elements
const showContainer = document.getElementById('show-list');
const playBarContainer = document.getElementById('bottom-player');
const mixcloudWidget = document.getElementById('player-iframe');

// Helper Functions
function getRandomColor() {
    return RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
}

async function fetchWithTimeout(url, timeout = 5000) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
            signal: controller.signal,
            cache: 'no-store'
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw error;
    }
}

async function fetchShowDetails(showKey) {
    try {
        return await fetchWithTimeout(`https://api.mixcloud.com${showKey}`);
    } catch (error) {
        console.error(`Failed to fetch show details for ${showKey}:`, error);
        return null;
    }
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Date unavailable';
    }
}

// UI Components
function createPlayButton(uploadKey) {
    const button = document.createElement('button');
    button.classList.add('play-button');
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M3 22V2l18 10L3 22z"/></svg>`;
    button.onclick = () => playShow(uploadKey);
    return button;
}

function createShowBox(show) {
    const showBox = document.createElement('div');
    showBox.classList.add('show-box');
    showBox.style.backgroundColor = '#011411';

    // Show image
    const img = document.createElement('img');
    img.src = show.pictures?.large || '';
    img.alt = show.name || 'Show image';
    img.onerror = () => img.src = 'default-show-image.png'; // Add a default image
    showBox.appendChild(img);

    // Show name
    const showName = document.createElement('div');
    showName.classList.add('show-name');
    showName.textContent = show.name.split(' hosted by')[0] || 'Unknown Show';
    showBox.appendChild(showName);

    // Host name
    const hostedBy = document.createElement('div');
    hostedBy.classList.add('hosted-by');
    hostedBy.textContent = `Hosted by ${show.hostName}`;
    showBox.appendChild(hostedBy);

    // Genres
    if (show.tags?.length > 0) {
        const genres = document.createElement('div');
        genres.classList.add('genres');
        genres.textContent = `Genres: ${show.tags.map(tag => tag.name).join(', ')}`;
        showBox.appendChild(genres);
    }

    // Description
    const description = document.createElement('div');
    description.classList.add('description');
    description.textContent = show.description || 'No description available.';
    showBox.appendChild(description);

    // Uploads
    show.uploads.forEach(upload => {
        const playContainer = document.createElement('div');
        playContainer.classList.add('play-container');

        playContainer.appendChild(createPlayButton(upload.key));

        const playDate = document.createElement('div');
        playDate.classList.add('play-date');
        playDate.textContent = formatDate(upload.created_time);
        playContainer.appendChild(playDate);

        showBox.appendChild(playContainer);
    });

    return showBox;
}

// Main Functions
function playShow(showKey) {
    const showUrl = `https://www.mixcloud.com/widget/iframe/?feed=${showKey}&autoplay=true`;
    mixcloudWidget.src = showUrl;
    playBarContainer.classList.add('active');
    playBarContainer.style.display = 'flex';
    playBarContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

async function fetchShows() {
    try {
        return await fetchWithTimeout(CLOUDCAST_API_URL);
    } catch (error) {
        console.error('Failed to fetch cloudcasts:', error);
        return { data: [] };
    }
}

async function renderShows() {
    showContainer.innerHTML = 'Loading shows...';

    try {
        const { data: shows } = await fetchShows();

        if (shows.length === 0) {
            showContainer.innerHTML = 'No shows available at the moment.';
            return;
        }

        const mergedShows = {};

        // Fetch and merge show details
        for (const show of shows) {
            const showDetails = await fetchShowDetails(show.key);
            if (!showDetails) continue;

            const showTitle = showDetails.name.split(' hosted by')[0].trim();
            const hostName = showDetails.name.match(/hosted by (.+)/i)?.[1] || 'Unknown Host';

            if (!mergedShows[showTitle]) {
                mergedShows[showTitle] = { ...showDetails, hostName, uploads: [] };
            }
            mergedShows[showTitle].uploads.push(showDetails);
        }

        // Sort and render shows
        showContainer.innerHTML = '';
        const sortedShows = Object.values(mergedShows)
            .sort((a, b) => new Date(b.created_time) - new Date(a.created_time));

        let index = 0;

        function renderNextBatch() {
            const nextBatch = sortedShows.slice(index, index + BATCH_SIZE);
            nextBatch.forEach(show => {
                showContainer.appendChild(createShowBox(show));
            });

            index += BATCH_SIZE;
            if (index < sortedShows.length) {
                setTimeout(renderNextBatch, 100);
            }
        }

        renderNextBatch();

    } catch (error) {
        console.error('Error rendering shows:', error);
        showContainer.innerHTML = 'Error loading shows. Please try again later.';
    }
}

// Initialize
renderShows(); 