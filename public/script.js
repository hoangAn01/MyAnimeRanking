document.addEventListener('DOMContentLoaded', () => {
  const animeListElement = document.getElementById('animeList');
  animeListElement.innerHTML = '<li>Đang tải dữ liệu từ server...</li>';

  // Use a placeholder for the production API URL.
  // When deployed, this should be the URL of your backend server.
  // ...existing code...
const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api/animes'
  : 'https://myanimeranking-backend.onrender.com/api/animes';
// ...existing code...
  fetch(apiUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((animes) => {
      if (animes.length === 0) {
        animeListElement.innerHTML = '<li>Chưa có dữ liệu anime trong database.</li>';
        return;
      }

      const animeHTML = animes
        .map(
          (anime) => `
        <li class="anime-item">
          <div class="anime-details">
            <h2 class="anime-title">${anime.title}</h2>
            <p class="anime-info"><strong>Điểm:</strong> ${anime.rating} ⭐</p>
            <p class="anime-info"><strong>Thể loại:</strong> ${anime.genre}</p>
            <p class="anime-description">${anime.description}</p>
          </div>
        </li>
      `
        )
        .join('');
      animeListElement.innerHTML = animeHTML;
    })
    .catch((error) => {
      console.error('Error fetching anime data:', error);
      animeListElement.innerHTML = '<li>Có lỗi xảy ra khi tải dữ liệu. Vui lòng kiểm tra console.</li>';
    });
});