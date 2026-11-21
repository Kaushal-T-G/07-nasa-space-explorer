// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to a range of 9 days (from 9 days ago to today)
// - Restrict dates to NASA's image archive (starting from 1995)
setupDateInputs(startInput, endInput);

const imgButton = document.getElementById('getImagesButton');
const gallery = document.getElementById('gallery');

// Paste your own key from https://api.nasa.gov between the quotes.
// If left empty, DEMO_KEY is used (works, but heavily rate-limited).
const MY_API_KEY = 'HNDt7pttKLbQgLgrkqkzkjkKh7bK7tp9tcwQ8FFq';
const API_KEY = MY_API_KEY || 'DEMO_KEY';

let currentImages = [];

imgButton.addEventListener('click', getSpaceimages);

async function getSpaceimages() {
  const startDate = startInput.value;
  const endDate = endInput.value;

  const url = `https://api.nasa.gov/planetary/apod?api_key=${API_KEY}&start_date=${startDate}&end_date=${endDate}&thumbs=true`;

  gallery.innerHTML = '<p class="loading"> Loading space photos...</p>';

  try {
    const response = await fetch(url);

    // Set by the service worker when it had to fall back to cached data
    const cacheStatus = response.headers.get('X-From-SW-Cache');

    if (cacheStatus === 'miss') {
      gallery.innerHTML = '<p class="error">📡 You\'re offline and this date range hasn\'t been saved yet. Try a range you\'ve viewed before.</p>';
      return;
    }

    if (!response.ok) {
      // Surface NASA's own error message (e.g. bad key, rate limit, invalid date)
      let detail = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        detail = body.error?.message || body.msg || detail;
      } catch { /* not JSON */ }
      gallery.innerHTML = `<p class="error">NASA API error: ${detail}</p>`;
      return;
    }

    const data = await response.json();

    data.reverse();
    currentImages = data;
    console.log(data);

    gallery.innerHTML = cacheStatus === 'true'
      ? '<p class="cached-notice">📦 Showing saved results. You\'re offline.</p>'
      : '';

    // NASA's API sometimes returns its site logo instead of the real photo
    // (a known issue on NASA's side since APOD moved to science.nasa.gov)
    const isPlaceholder = (item) => (item.url || '').includes('nasa-logo');
    if (data.length && data.every(isPlaceholder)) {
      gallery.innerHTML += '<p class="cached-notice">⚠️ NASA\'s API is currently returning placeholder logos instead of the real photos. This is a problem on NASA\'s side, so try again later.</p>';
    }

    data.forEach((item, index) => {
      let media;

      if (item.media_type === 'image') {
        media = `
          <div class="img-wrap">
            <img src="${item.url}" alt="${item.title}" />
          </div>`;
      } else if (item.media_type === 'video') {
        const thumb = item.thumbnail_url
          ? `<img src="${item.thumbnail_url}" alt="${item.title}" />`
          : `<div class="video-placeholder">🎬</div>`;
        media = `
          <div class="img-wrap video">
            ${thumb}
            <span class="play-badge">▶ Video</span>
          </div>
          <a href="${item.url}" target="_blank" rel="noopener" class="video-link">Watch video ↗</a>`;
      } else {
        media = `<p>Media not available for this day.</p>`;
      }

      gallery.innerHTML += `
        <div class="gallery-item" data-index="${index}">
          ${media}
          <h3>${item.title}</h3>
          <p class="date">${item.date}</p>
        </div>
      `;
    });

    // Let the user know if they switched tabs while images were loading
    if (document.hidden && typeof showAppNotification === 'function') {
      showAppNotification('Your space images are ready 🌌', `${data.length} images from ${startDate} to ${endDate}`);
    }
  } catch (error) {
    console.error(error);
    gallery.innerHTML = '<p class="error">Couldn\'t load images. Try again in a minute.</p>';
  }
}

// ===== Modal =====
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');
const modalMedia = document.getElementById('modalMedia');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');

// Open the modal when any gallery card is clicked
gallery.addEventListener('click', (event) => {
  if (event.target.closest('a')) return; // let "Watch video" links work normally

  const card = event.target.closest('.gallery-item');
  if (!card) return;

  const item = currentImages[card.dataset.index];
  openModal(item);
});

function openModal(item) {
  if (item.media_type === 'image') {
    // hdurl is the high-resolution version, if NASA provides one
    modalMedia.innerHTML = `<img src="${item.hdurl || item.url}" alt="${item.title}" />`;
  } else if (item.media_type === 'video') {
    const thumb = item.thumbnail_url
      ? `<img src="${item.thumbnail_url}" alt="${item.title}" />`
      : '';
    modalMedia.innerHTML = `
      ${thumb}
      <a href="${item.url}" target="_blank" rel="noopener" class="video-button">▶ Watch this video</a>`;
  } else {
    modalMedia.innerHTML = '';
  }

  modalTitle.textContent = item.title;
  modalDate.textContent = item.date;
  modalExplanation.textContent = item.explanation;

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.classList.add('hidden');
  modalMedia.innerHTML = '';
  document.body.style.overflow = '';
}

// Three ways to close: the X button, clicking the dark background, or pressing Escape
modalClose.addEventListener('click', closeModal);

modal.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
    closeModal();
  }
});

// ===== Random "Did You Know?" fact =====
const spaceFacts = [
  'A day on Venus is longer than its year.',
  'Neutron stars are so dense that a teaspoon would weigh about a billion tons.',
  'There are more stars in the universe than grains of sand on all of Earth\'s beaches.',
  'Footprints on the Moon could last millions of years because there is no wind to erase them.',
  'Jupiter is so big that all the other planets could fit inside it.',
  'Light from the Sun takes about 8 minutes to reach Earth.',
  'Saturn is less dense than water. It would float in a giant enough bathtub.',
  'One million Earths could fit inside the Sun.',
  'The Milky Way and Andromeda galaxies will collide in about 4.5 billion years.',
  'Space is completely silent because there is no air for sound to travel through.'
];

const randomFact = spaceFacts[Math.floor(Math.random() * spaceFacts.length)];
document.getElementById('spaceFact').innerHTML = `<strong> Did You Know?</strong> ${randomFact}`;