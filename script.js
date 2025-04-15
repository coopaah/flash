document.addEventListener('DOMContentLoaded', () => {
  const searchBar = document.getElementById('search-bar');
  const searchIcon = document.getElementById('search-icon');
  const aiIcon = document.getElementById('ai-icon');
  const suggestionsContainer = document.getElementById('suggestions');
  const siteInfoTooltip = document.getElementById('site-info-tooltip');
  const resultsContainer = document.getElementById('results');
  const aiSummary = document.getElementById('ai-summary');
  const navTabs = document.querySelector('.nav-tabs');
  const header = document.getElementById('header');
  
  // View state management
  let currentView = 'search'; // 'search' or 'images'
  
  function debounce(func, timeout = 150) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), timeout);
    };
  }
  
  // Initialize thinking toggle if available
  const thinkingToggle = document.getElementById('thinking-toggle');
  const thinkingContainer = document.getElementById('thinking-container');
  
  if (thinkingToggle && thinkingContainer) {
    thinkingToggle.addEventListener('click', () => {
      thinkingContainer.classList.toggle('visible');
      thinkingToggle.classList.toggle('open');
      
      const spanEl = thinkingToggle.querySelector('span');
      if (spanEl) {
        spanEl.textContent = thinkingContainer.classList.contains('visible') 
          ? 'Hide thinking' 
          : 'Show thinking';
      }
    });
  }
  
  // Fetch search suggestions
  const fetchSuggestions = async (query) => {
    try {
      const response = await fetch(`https://api.coopr.tech:8148/flashtag-ai/autocomplete?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      return data.suggestions || [];
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      return [];
    }
  };
  
  // Update suggestions UI
  const updateSuggestions = debounce(async () => {
    if (!searchBar || !suggestionsContainer) return;
    
    const query = searchBar.value.trim();
    if (!query) {
      suggestionsContainer.innerHTML = '';
      return;
    }
    
    const suggestions = await fetchSuggestions(query);
    
    suggestionsContainer.innerHTML = '';
    
    if (suggestions.length > 0) {
      suggestions.forEach(suggestion => {
        const suggestionEl = document.createElement('div');
        suggestionEl.className = 'suggestion';
        suggestionEl.textContent = suggestion;
        
        // Make suggestion clickable
        suggestionEl.addEventListener('click', () => {
          searchBar.value = suggestion;
          suggestionsContainer.innerHTML = '';
          performSearch(suggestion);
        });
        
        suggestionsContainer.appendChild(suggestionEl);
      });
    }
  }, 300);
  
  // Main search function
  const performSearch = (query, view = currentView) => {
    // Hide suggestions when search is performed
    if (suggestionsContainer) {
      suggestionsContainer.innerHTML = '';
    }
    
    // For image search
    if (view === 'images') {
      fetchAndDisplayImages(query);
      updateTabSelection('images');
      return;
    }
    
    // For regular search
    if (window.location.pathname !== '/results') {
      window.location.href = `/results?f=${encodeURIComponent(query)}`;
    } else {
      // If already on results page, update content
      const queryParams = new URLSearchParams(window.location.search);
      queryParams.set('f', query);
      window.history.pushState({}, '', `${window.location.pathname}?${queryParams}`);
      
      // Stream content
      handleStreamingResponse(query);
    }
  };
  
  // Handle AI streaming response
  window.handleStreamingResponse = async (query) => {
    const resultsElement = document.getElementById('results');
    const aiSummaryContent = document.getElementById('ai-summary-content');
    const loadingElement = document.getElementById('loading');
    const aiSummaryElement = document.getElementById('ai-summary');
    const thinkingContent = document.getElementById('thinking-content');
    const refinedQueries = document.getElementById('refined-queries');
    const queryChips = document.getElementById('query-chips');
    
    if (!resultsElement || !aiSummaryContent) return;
    
    // Clear existing content
    aiSummaryContent.innerHTML = '';
    if (thinkingContent) thinkingContent.innerHTML = '';
    if (queryChips) queryChips.innerHTML = '';
    if (refinedQueries) refinedQueries.style.display = 'none';
    
    // Show loading state
    if (loadingElement) loadingElement.style.display = 'flex';
    
    // Clear existing results
    resultsElement.innerHTML = '';
    
    try {
      // Set up Server-Sent Events connection
      const eventSource = new EventSource(`https://api.coopr.tech:8148/flashtag-ai/stream?f=${encodeURIComponent(query)}`);
      
      // Stream processing state
      let summaryText = '';
      let hasResults = false;
      let newWords = [];
      let animationQueue = [];
      let isProcessing = false;
      let allThoughts = [];
      let curatedResults = [];
      
      // Process animation queue
      const processAnimationQueue = async () => {
        if (isProcessing || animationQueue.length === 0) return;
        
        isProcessing = true;
        const batch = animationQueue.shift();
        
        // Apply markdown formatting to the words
        const formattedWords = parseMarkdown(batch.join(' ')).split(' ');
        
        animateWords(aiSummaryContent, formattedWords);
        
        // Add thinking/reasoning to the thinking section
        if (thinkingContent) {
          // Generate a thinking thought for this batch of words
          const thought = generateThought(batch.join(' '), query, allThoughts);
          allThoughts.push(thought);
          
          const thoughtEl = document.createElement('div');
          thoughtEl.className = 'thinking-item';
          thoughtEl.textContent = thought;
          thinkingContent.appendChild(thoughtEl);
        }
        
        await new Promise(resolve => setTimeout(resolve, 150));
        isProcessing = false;
        processAnimationQueue();
      };
      
      // Generate simulated reasoning points
      const generateThought = (text, query, existingThoughts) => {
        const thoughts = [
          `Analyzing information about "${query}"...`,
          `Identifying key points related to "${query}"...`,
          `Finding supporting evidence for this claim...`,
          `Cross-referencing data from multiple sources...`,
          `Evaluating the credibility of this information...`,
          `Considering alternative perspectives on this topic...`,
          `Looking for recent updates or changes to this information...`,
          `Summarizing the main findings about "${query}"...`,
          `Checking if this addresses the user's search intent...`,
          `Determining the most relevant details to include...`
        ];
        
        // Filter out thoughts we've already used
        const availableThoughts = thoughts.filter(t => !existingThoughts.includes(t));
        
        // If we've used all thoughts, reset
        if (availableThoughts.length === 0) return thoughts[Math.floor(Math.random() * thoughts.length)];
        
        return availableThoughts[Math.floor(Math.random() * availableThoughts.length)];
      };
      
      // Parse markdown in AI responses
      function parseMarkdown(text) {
        if (!text) return '';
        
        // Handle bold (** syntax)
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Handle italic (* syntax)
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Handle highlight/underline with __
        text = text.replace(/__(.*?)__/g, '<span class="highlight">$1</span>');
        
        // Handle strikethrough
        text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');
        
        // Convert line breaks to HTML breaks
        text = text.replace(/\n/g, '<br>');
        
        return text;
      }
      
      // Word animation
      function animateWords(element, newWords) {
        if (!newWords || newWords.length === 0) return;
        
        // Create a new span for each word with staggered animation
        const container = document.createElement('span');
        container.className = 'animated-word-container';
        
        newWords.forEach((word, index) => {
          const wordSpan = document.createElement('span');
          wordSpan.innerHTML = word + ' '; // Use innerHTML to support HTML from markdown
          wordSpan.className = 'animated-word';
          wordSpan.style.opacity = '0';
          wordSpan.style.transition = `opacity 0.2s ease ${index * 0.05}s`;
          container.appendChild(wordSpan);
          
          // Start the fade-in animation
          setTimeout(() => {
            wordSpan.style.opacity = '1';
          }, 10);
        });
        
        // Append the new words to the content
        element.appendChild(container);
      }
      
      // Display search results
      const displayResults = (results, isCurated = false, curatedFor = '') => {
        if (!results || !resultsElement) return;
        
        results.forEach(result => {
          if (!result || !result.result_url) return;
          
          const resultElement = document.createElement('div');
          resultElement.className = isCurated ? 'result curated' : 'result';
          
          // For animation of new results
          resultElement.style.opacity = '0';
          resultElement.style.transform = 'translateY(20px)';
          
          // Add favicon using our favicon endpoint
          let faviconHtml = '';
          try {
            const domain = new URL(result.result_url).hostname;
            faviconHtml = `<img class="favicon-img" src="/favicon/${encodeURIComponent(domain)}" alt="" />`;
          } catch (err) {
            console.error('Error parsing URL for favicon:', err);
          }
          
          // Create curated badge if needed
          const curatedBadge = isCurated ? 
            `<div class="curated-badge">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              AI Curated
            </div>` : '';
          
          // Add curated-for text if applicable
          const curatedForHtml = isCurated && curatedFor ? 
            `<div class="curated-for">For search: "${curatedFor}"</div>` : '';
          
          resultElement.innerHTML = `
            ${curatedBadge}
            <a href="${result.result_url}" class="result-title" target="_blank">${result.result_title || 'Untitled'}</a>
            <div class="result-url">${faviconHtml}${new URL(result.result_url).hostname}</div>
            <div class="result-description">${result.result_og_description || ''}</div>
            ${curatedForHtml}
          `;
          
          resultsElement.appendChild(resultElement);
          
          // Animate in
          setTimeout(() => {
            resultElement.style.opacity = '1';
            resultElement.style.transform = 'translateY(0)';
          }, 50);
        });
      };
      
      // Handle various event stream message types
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'results':
              // Initial search results
              if (data.results && data.results.length > 0) {
                displayResults(data.results);
                hasResults = true;
              }
              break;
              
            case 'content':
              // Streaming AI content
              if (data.text) {
                summaryText += data.text;
                
                // Split the new text into words and add to animation queue
                newWords = data.text.trim().split(' ').filter(w => w);
                
                if (newWords.length > 0) {
                  // Group words in batches for smoother animation
                  animationQueue.push(newWords);
                  
                  // Process the animation queue
                  if (!isProcessing) {
                    processAnimationQueue();
                  }
                }
              }
              break;
              
            case 'curated_queries':
              // AI-generated refined search queries
              if (data.queries && data.queries.length > 0 && queryChips && refinedQueries) {
                queryChips.innerHTML = '';
                
                data.queries.forEach(refinedQuery => {
                  const chipEl = document.createElement('div');
                  chipEl.className = 'query-chip';
                  chipEl.textContent = refinedQuery;
                  chipEl.addEventListener('click', () => {
                    performSearch(refinedQuery);
                  });
                  queryChips.appendChild(chipEl);
                });
                
                refinedQueries.style.display = 'block';
              }
              break;
              
            case 'curated_results':
              // Store curated results to display them
              if (data.results && data.results.length > 0) {
                curatedResults.push({
                  query: data.query,
                  results: data.results
                });
              }
              break;
              
            case 'end':
              // End of stream, display curated results
              if (loadingElement) loadingElement.style.display = 'none';
              
              // Display all curated results after a short delay
              setTimeout(() => {
                if (curatedResults.length > 0) {
                  // Create a section header for curated results
                  const curatedHeader = document.createElement('h3');
                  curatedHeader.className = 'curated-results-header';
                  curatedHeader.textContent = 'AI Curated Results';
                  resultsElement.appendChild(curatedHeader);
                  
                  // Display each set of curated results
                  curatedResults.forEach(set => {
                    displayResults(set.results, true, set.query);
                  });
                }
              }, 1000);
              
              eventSource.close();
              break;
              
            case 'error':
              if (loadingElement) loadingElement.style.display = 'none';
              if (aiSummaryContent) {
                aiSummaryContent.innerHTML = `<p>Sorry, I encountered an issue: ${data.message || 'Unknown error'}</p>`;
              }
              eventSource.close();
              break;
          }
        } catch (error) {
          console.error('Error processing stream data:', error);
        }
      };
      
      // Error handling
      eventSource.onerror = () => {
        console.error('EventSource failed');
        if (loadingElement) loadingElement.style.display = 'none';
        eventSource.close();
        
        if (aiSummaryContent && !aiSummaryContent.textContent) {
          aiSummaryContent.innerHTML = '<p>Sorry, I encountered an issue processing your request.</p>';
        }
      };
      
    } catch (error) {
      console.error('Error:', error);
      if (loadingElement) loadingElement.style.display = 'none';
      if (aiSummaryContent) {
        aiSummaryContent.innerHTML = '<p>Sorry, I encountered an issue processing your request.</p>';
      }
    }
  };
  
  // Fetch and display images
  async function fetchAndDisplayImages(query) {
    const resultsElement = document.getElementById('results');
    const loadingElement = document.getElementById('loading');
    const aiSummaryElement = document.getElementById('ai-summary');
    
    if (!resultsElement) return;
    
    // Clear existing content and show loading state
    resultsElement.innerHTML = '';
    if (loadingElement) loadingElement.style.display = 'flex';
    if (aiSummaryElement) aiSummaryElement.style.display = 'none';
    
    try {
      const response = await fetch(`https://api.coopr.tech:8148/flashtag-ai/images?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (loadingElement) loadingElement.style.display = 'none';
      
      if (data.images && data.images.length > 0) {
        // Create image grid container
        const imageGrid = document.createElement('div');
        imageGrid.className = 'image-grid';
        
        // Add Google attribution
        const attribution = document.createElement('div');
        attribution.className = 'google-attribution';
        attribution.innerHTML = 'Images powered by Google Images';
        resultsElement.appendChild(attribution);
        
        // Add images to grid
        data.images.forEach((image, index) => {
          const imageCard = document.createElement('div');
          imageCard.className = 'image-card';
          imageCard.style.animationDelay = `${index * 50}ms`;
          
          imageCard.innerHTML = `
            <div class="image-container">
              <img src="${image.thumbnail}" alt="${image.title}" loading="lazy" />
            </div>
            <div class="image-title">${image.title}</div>
            <div class="image-source">${image.source}</div>
          `;
          
          // Add click handler to open full image
          imageCard.addEventListener('click', () => {
            openImageModal(image.url, image.title);
          });
          
          imageGrid.appendChild(imageCard);
        });
        
        resultsElement.appendChild(imageGrid);
      } else {
        resultsElement.innerHTML = '<div class="no-results">No images found for your query. Try a different search term.</div>';
      }
      
    } catch (error) {
      console.error('Error fetching images:', error);
      if (loadingElement) loadingElement.style.display = 'none';
      resultsElement.innerHTML = '<div class="error-message">Sorry, there was an error loading images. Please try again later.</div>';
    }
  }
  
  // Image modal functionality
  function openImageModal(imageUrl, title) {
    const modal = document.getElementById('image-modal') || createImageModal();
    const modalImg = modal.querySelector('.modal-image');
    const modalTitle = modal.querySelector('.modal-title');
    
    modalImg.src = imageUrl;
    modalTitle.textContent = title;
    modal.classList.add('visible');
    
    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden';
  }
  
  // Create image modal if it doesn't exist
  function createImageModal() {
    const modal = document.createElement('div');
    modal.id = 'image-modal';
    modal.className = 'image-modal';
    
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close-modal">&times;</span>
        <img class="modal-image" src="" alt="" />
        <div class="modal-title"></div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal when clicking the close button or outside the image
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.addEventListener('click', closeImageModal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeImageModal();
    });
    
    return modal;
  }
  
  // Close image modal
  function closeImageModal() {
    const modal = document.getElementById('image-modal');
    if (modal) {
      modal.classList.remove('visible');
      // Restore body scrolling
      document.body.style.overflow = '';
    }
  }
  
  // Update tab selection
  function updateTabSelection(tab) {
    if (!navTabs) return;
    
    const tabs = navTabs.querySelectorAll('.nav-tab');
    tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    
    currentView = tab;
    
    // Toggle content visibility
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `${tab}-content`);
    });
    
    // Hide/show AI summary for images view
    const aiSummaryEl = document.getElementById('ai-summary');
    if (aiSummaryEl) {
      aiSummaryEl.style.display = tab === 'images' ? 'none' : 'block';
    }
  }
  
  // Initialize navigation tabs if they exist
  function initNavTabs() {
    if (!navTabs) {
      // Create navigation tabs if they don't exist
      const tabsContainer = document.createElement('div');
      tabsContainer.className = 'nav-tabs';
      tabsContainer.innerHTML = `
        <div class="nav-tab active" data-tab="search">Search</div>
        <div class="nav-tab" data-tab="images">Images</div>
      `;
      
      // Insert tabs after header
      const header = document.querySelector('.header');
      if (header && header.nextSibling) {
        header.parentNode.insertBefore(tabsContainer, header.nextSibling);
      }
      
      // Add click handlers to tabs
      const tabs = tabsContainer.querySelectorAll('.nav-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          updateTabSelection(tab.dataset.tab);
          
          // Re-run search with current query if available
          const query = (searchBar && searchBar.value.trim()) || 
                      new URLSearchParams(window.location.search).get('f');
          
          if (query) {
            performSearch(query, tab.dataset.tab);
          }
        });
      });
    } else {
      // Add click handlers to existing tabs
      const tabs = navTabs.querySelectorAll('.nav-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          updateTabSelection(tab.dataset.tab);
          
          // Re-run search with current query if available
          const query = (searchBar && searchBar.value.trim()) || 
                      new URLSearchParams(window.location.search).get('f');
          
          if (query) {
            performSearch(query, tab.dataset.tab);
          }
        });
      });
    }
  }
  
  // Flashtag detection and site info tooltip
  function checkForFlashTag() {
    if (!searchBar || !siteInfoTooltip) return;
    
    const query = searchBar.value.trim();
    if (!query) {
      siteInfoTooltip.classList.remove('visible');
      return;
    }
    
    // Load sites for Flashtags
    fetch('/sites.json')
      .then(response => response.json())
      .then(sites => {
        const match = query.match(/^(.*?)\s+!(\w+)$/);
        if (match) {
          const tag = match[2];
          const site = sites.find(s => s.alias && s.alias.includes(tag));
          
          if (site && site.title) {
            // Show the site info with favicon
            let favicon = '';
            try {
              const domain = new URL(site.site).hostname;
              favicon = `<img class="favicon-img" src="/favicon/${encodeURIComponent(domain)}" alt="" />`;
            } catch (err) {
              console.error('Error parsing URL for favicon:', err);
            }
            
            siteInfoTooltip.innerHTML = `${favicon}Searching on ${site.title}`;
            siteInfoTooltip.classList.add('visible');
          } else {
            siteInfoTooltip.classList.remove('visible');
          }
        } else {
          siteInfoTooltip.classList.remove('visible');
        }
      })
      .catch(error => {
        console.error('Error loading sites:', error);
      });
  }
  
  // Event listeners
  if (searchBar) {
    searchBar.addEventListener('input', () => {
      updateSuggestions();
      checkForFlashTag();
    });
    
    searchBar.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = searchBar.value.trim();
        if (query) {
          performSearch(query, currentView);
        }
      }
    });
    
    // Hide suggestions when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (e.target !== searchBar && suggestionsContainer) {
        suggestionsContainer.innerHTML = '';
      }
    });
  }
  
  if (searchIcon) {
    searchIcon.addEventListener('click', () => {
      const query = searchBar.value.trim();
      if (query) {
        performSearch(query, currentView);
      }
    });
  }
  
  if (aiIcon) {
    aiIcon.addEventListener('click', () => {
      const query = searchBar.value.trim();
      if (query) {
        performSearch(query, 'search'); // AI icon always triggers search view
      }
    });
  }
  
  // Initialize the page
  function init() {
    // If we're on the home page and the header is centered
    if (header && header.classList.contains('centered')) {
      // Set up the header animation on focus
      if (searchBar) {
        searchBar.addEventListener('focus', () => {
          header.classList.remove('centered');
          header.classList.add('top');
        });
      }
    }
    
    // Initialize navigation tabs
    initNavTabs();
    
    // If we're on the results page, process query param
    if (window.location.pathname === '/results') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryParam = urlParams.get('f');
      const viewParam = urlParams.get('view') || 'search';
      
      if (queryParam) {
        // Set the search bar value
        if (searchBar) searchBar.value = decodeURIComponent(queryParam);
        
        // Set current view
        currentView = viewParam;
        updateTabSelection(currentView);
        
        // Perform the search
        if (currentView === 'images') {
          fetchAndDisplayImages(decodeURIComponent(queryParam));
        } else {
          handleStreamingResponse(decodeURIComponent(queryParam));
        }
      }
    }
    
    // Register service worker for caching if not already registered
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        })
        .catch(err => {
          console.log('ServiceWorker registration failed: ', err);
        });
    }
  }
  
  // Initialize the page
  init();
});
