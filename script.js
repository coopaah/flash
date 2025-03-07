document.addEventListener('DOMContentLoaded', () => {
  const searchBar = document.getElementById('search-bar');
  const suggestionsContainer = document.getElementById('suggestions');
  const copyButton = document.getElementById('copy-button');
  const copyInput = document.getElementById('copy-input');
  const searchButton = document.getElementById('search-button');
  const siteInfo = document.getElementById('site-info');
  const flashtagsContainer = document.getElementById('flashtags-container');

  fetch('/sites.json')
    .then(response => response.json())
    .then(sites => {
      const performSearch = (query) => {
        const [searchTerm, alias] = query.split(' !');
        if (alias) {
          const site = sites.find(s => s.alias.includes(alias));
          if (site) {
            window.location.href = site.site + encodeURIComponent(searchTerm);
          } else {
            window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
          }
        } else {
          window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        }
      };

      const urlParams = new URLSearchParams(window.location.search);
      const queryParam = urlParams.get('f');
      if (queryParam) {
        performSearch(queryParam);
      }

      searchBar.addEventListener('input', () => {
        const query = searchBar.value;
        const [searchTerm, alias] = query.split(' !');
        if (alias) {
          const site = sites.find(s => s.alias.includes(alias));
          if (site) {
            siteInfo.textContent = `Searching on ${site.title}`;
            siteInfo.style.display = 'block';
          } else {
            siteInfo.textContent = '';
            siteInfo.style.display = 'none';
          }
        } else {
          siteInfo.textContent = '';
          siteInfo.style.display = 'none';
          if (query.length > 0) {
            fetch(`https://api.coopr.tech:8148/suggestions?q=${query}`)
              .then(response => response.json())
              .then(data => {
                suggestionsContainer.innerHTML = '';
                data.suggestions.forEach(suggestion => {
                  const suggestionElement = document.createElement('div');
                  suggestionElement.className = 'suggestion';
                  suggestionElement.textContent = suggestion;
                  suggestionsContainer.appendChild(suggestionElement);
                });
              })
              .catch(error => {
                console.error('Error fetching suggestions:', error);
              });
          } else {
            suggestionsContainer.innerHTML = '';
          }
        }
      });

      searchButton.addEventListener('click', () => {
        const query = searchBar.value;
        window.location.href = `/?f=${encodeURIComponent(query)}`;
      });

      suggestionsContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('suggestion')) {
          searchBar.value = event.target.textContent;
          suggestionsContainer.innerHTML = '';
        }
      });

      copyButton.addEventListener('click', () => {
        copyInput.select();
        document.execCommand('copy');
        alert('Link copied to clipboard!');
      });

      if (flashtagsContainer) {
        sites.forEach(site => {
          site.alias.forEach(alias => {
            const flashtagElement = document.createElement('div');
            flashtagElement.className = 'flashtag';
            flashtagElement.textContent = `!${alias}`;
            flashtagsContainer.appendChild(flashtagElement);
          });
        });
      }
    })
    .catch(error => {
      console.error('Error loading sites:', error);
    });
});
