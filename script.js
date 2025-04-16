// script.js with follow-up conversation feature and fixes
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
  let currentResults = null; // Store current search results
  let currentImageResults = null; // Store current image results
  let conversationHistory = []; // Store conversation history
  let followupCount = 0; // Track number of follow-ups for current search
  const MAX_FOLLOWUPS = 3; // Maximum number of followups allowed per search
  let hasLoadedImages = false; // Track if images have been loaded
  let hasLoadedSearch = false; // Track if search results have been loaded
  
  // Check for query parameter in URL on page load
  function checkUrlQueryParam() {
    // Check if we have a query in the URL (for direct searches via ?f=)
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('f');
    
    if (queryParam) {
      // We're on the home page with a query param, perform immediate search
      const query = decodeURIComponent(queryParam);
      if (searchBar) searchBar.value = query;
      
      // Determine where to redirect
      if (window.location.pathname === '/') {
        // Redirect to results page
        window.location.href = `/results?f=${encodeURIComponent(query)}`;
        return;
      }
      
      // Check if it has a flashtag
      const flashtagMatch = query.match(/^(.*?)\s+!(\w+)$/);
      if (flashtagMatch) {
        // This is a flashtag search
        handleFlashTagSearch(query, flashtagMatch);
      } else if (window.location.pathname === '/results') {
        // For results page, check view parameter
        const viewParam = urlParams.get('view');
        if (viewParam === 'images') {
          updateTabSelection('images');
          if (!hasLoadedImages) {
            fetchAndDisplayImages(query);
          }
        } else {
          updateTabSelection('search');
          if (!hasLoadedSearch) {
            performSearch(query);
          }
        }
      }
    }
  }
  
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
    
    // Check for Flashtag format (query !tag)
    const flashtagMatch = query.match(/^(.*?)\s+!(\w+)$/);
    if (flashtagMatch) {
      return handleFlashTagSearch(query, flashtagMatch);
    }
    
    // For image search
    if (view === 'images') {
      fetchAndDisplayImages(query);
      updateTabSelection('images');
      return;
    }
    
    // Reset conversation history for new search
    conversationHistory = [];
    followupCount = 0;
    
    // For regular search
    if (window.location.pathname !== '/results') {
      window.location.href = `/results?f=${encodeURIComponent(query)}`;
    } else {
      // If already on results page, update content
      const queryParams = new URLSearchParams(window.location.search);
      queryParams.set('f', query);
      window.history.pushState({}, '', `${window.location.pathname}?${queryParams}`);
      
      // Don't restream if we've already loaded this search
      if (!hasLoadedSearch) {
        // Stream content
        handleStreamingResponse(query);
        hasLoadedSearch = true;
      }
    }
  };
  
  // Handle Flashtag searches
  const handleFlashTagSearch = (query, match) => {
    const searchTerm = match[1].trim();
    const tag = match[2].toLowerCase();
    
    // Load sites.json to find matching tag
    fetch('/sites.json')
      .then(response => response.json())
      .then(sites => {
        const site = sites.find(s => s.alias && s.alias.includes(tag));
        
        if (site) {
          // Redirect to the appropriate site with the search term
          window.location.href = `${site.site}${encodeURIComponent(searchTerm)}`;
        } else {
          // If tag not found, perform regular search
          const cleanQuery = query.replace(/\s+!\w+$/, '');
          performSearch(cleanQuery);
        }
      })
      .catch(error => {
        console.error('Error loading sites:', error);
        // Fall back to regular search if sites.json fails to load
        const cleanQuery = query.replace(/\s+!\w+$/, '');
        performSearch(cleanQuery);
      });
  };
  
  // Handle AI streaming response
  window.handleStreamingResponse = async (query, isFollowup = false) => {
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
    if (queryChips && !isFollowup) queryChips.innerHTML = '';
    if (refinedQueries && !isFollowup) refinedQueries.style.display = 'none';
    
    // Show loading state
    if (loadingElement) loadingElement.style.display = 'flex';
    
    // Clear existing results only if this is a new search, not a followup
    if (!isFollowup) {
      resultsElement.innerHTML = '';
    }
    
    try {
      // Prepare conversation history for the API
      let historyParam = '';
      if (isFollowup && conversationHistory.length > 0) {
        historyParam = `&history=${encodeURIComponent(JSON.stringify(conversationHistory))}`;
      }
      
      // Set up Server-Sent Events connection
      const eventSource = new EventSource(`https://api.coopr.tech:8148/flashtag-ai/stream?f=${encodeURIComponent(query)}${historyParam}${isFollowup ? '&followup=true' : ''}`);
      
      // Stream processing state
      let summaryText = '';
      let hasResults = false;
      let newWords = [];
      let animationQueue = [];
      let isProcessing = false;
      let allThoughts = [];
      let curatedResults = [];
      
      // If this is a followup, add it to conversation UI
      if (isFollowup) {
        const followupQuestion = document.createElement('div');
        followupQuestion.className = 'followup-question';
        followupQuestion.innerHTML = `
          <div class="user-query">
            <strong>You:</strong> ${query}
          </div>
        `;
        aiSummaryContent.appendChild(followupQuestion);
        
        // Add a response container
        const followupResponse = document.createElement('div');
        followupResponse.className = 'followup-response';
        followupResponse.innerHTML = `<strong>AI:</strong> `;
        aiSummaryContent.appendChild(followupResponse);
        
        // Update aiSummaryContent to be this response container for streaming
        aiSummaryContent = followupResponse;
      }
      
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
        
        // Store results for tab switching
        if (!isCurated && !isFollowup) {
          currentResults = results;
        }
        
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
              if (data.results && data.results.length > 0 && !isFollowup) {
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
              // AI-generated refined search queries (only for new searches, not followups)
              if (!isFollowup && data.queries && data.queries.length > 0 && queryChips && refinedQueries) {
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
              // Store curated results to display them (only for new searches, not followups)
              if (!isFollowup && data.results && data.results.length > 0) {
                curatedResults.push({
                  query: data.query,
                  results: data.results
                });
              }
              break;
              
            case 'end':
              // End of stream, display curated results
              if (loadingElement) loadingElement.style.display = 'none';
              
              // Display all curated results after a short delay (only for new searches)
              if (!isFollowup) {
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
              }
              
              // Add the finalized conversation to history
              if (summaryText) {
                conversationHistory.push({
                  role: 'user',
                  content: query
                });
                conversationHistory.push({
                  role: 'assistant',
                  content: summaryText
                });
                
                // If this was a followup, increment the counter
                if (isFollowup) {
                  followupCount++;
                  
                  // After response, show the followup UI if we haven't reached max
                  if (followupCount < MAX_FOLLOWUPS) {
                    // Show followup UI after a slight delay
                    setTimeout(addFollowupUI, 500);
                  }
                } else {
                  // For new searches, add followup UI
                  setTimeout(addFollowupUI, 500);
                }
              }
              
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
  
  // Add followup UI
  function addFollowupUI() {
    const aiSummaryContent = document.getElementById('ai-summary-content');
    if (!aiSummaryContent) return;
    
    // Check if we already have a followup container
    let followupContainer = document.querySelector('.followup-container');
    
    if (!followupContainer) {
      followupContainer = document.createElement('div');
      followupContainer.className = 'followup-container';
      
      // Create the followup container with input and button
      followupContainer.innerHTML = `
        <div class="followup-header">Ask a follow-up question (${followupCount}/${MAX_FOLLOWUPS})</div>
        <div class="followup-input-container">
          <input type="text" class="followup-input" placeholder="Ask a follow-up question..." />
          <button class="followup-button">Ask</button>
        </div>
      `;
      
      aiSummaryContent.appendChild(followupContainer);
      
      // Add event listeners
      const followupInput = followupContainer.querySelector('.followup-input');
      const followupButton = followupContainer.querySelector('.followup-button');
      
      followupInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const followupQuery = followupInput.value.trim();
          if (followupQuery) {
            handleFollowup(followupQuery);
            followupInput.value = '';
            followupContainer.remove(); // Remove the container after submission
          }
        }
      });
      
      followupButton.addEventListener('click', () => {
        const followupQuery = followupInput.value.trim();
        if (followupQuery) {
          handleFollowup(followupQuery);
          followupInput.value = '';
          followupContainer.remove(); // Remove the container after submission
        }
      });
      
      // Focus the input
      setTimeout(() => followupInput.focus(), 100);
    } else {
      // Update the header to show correct count
      const header = followupContainer.querySelector('.followup-header');
      if (header) {
        header.textContent = `Ask a follow-up question (${followupCount}/${MAX_FOLLOWUPS})`;
      }
    }
  }
  
  // Handle followup question
  function handleFollowup(query) {
    // Process the followup query
    handleStreamingResponse(query, true);
  }
  
  // Fetch and display images
  async function fetchAndDisplayImages(query) {
    const resultsElement = document.getElementById('results');
    const loadingElement = document.getElementById('loading');
    const aiSummaryElement = document.getElementById('ai-summary');
    
    if (!resultsElement) return;
    
    // If we already have images for this query, just show them
    if (currentImageResults && currentImageResults.query === query) {
      if (loadingElement) loadingElement.style.display = 'none';
      if (aiSummaryElement) aiSummaryElement.style.display = 'none';
      
      // Display the cached images
      resultsElement.innerHTML = '';
      displayImageResults(currentImageResults.images);
      return;
    }
    
    // Clear existing content and show loading state
    resultsElement.innerHTML = '';
    if (loadingElement) loadingElement.style.display = 'flex';
    if (aiSummaryElement) aiSummaryElement.style.display = 'none';
    
    try {
      const response = await fetch(`https://api.coopr.tech:8148/flashtag-ai/images?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (loadingElement) loadingElement.style.display = 'none';
      
      // Cache the image results
      currentImageResults = {
        query: query,
        images: data.images || []
      };
      
      // Display images
      displayImageResults(data.images || []);
      
    } catch (error) {
      console.error('Error fetching images:', error);
      if (loadingElement) loadingElement.style.display = 'none';
      resultsElement.innerHTML = '<div class="error-message">Sorry, there was an error loading images. Please try again later.</div>';
    }
  }
  
  // Display image results
  function displayImageResults(images) {
    const resultsElement = document.getElementById('results');
    if (!resultsElement) return;
    
    if (images && images.length > 0) {
      // Create image grid container
      const imageGrid = document.createElement('div');
      imageGrid.className = 'image-grid';
      
      // Add Google attribution
      const attribution = document.createElement('div');
      attribution.className = 'google-attribution';
      attribution.innerHTML = 'Images powered by Google Images';
      resultsElement.appendChild(attribution);
      
      // Add images to grid
      images.forEach((image, index) => {
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
  
  // Update tab selection without refreshing results
  function updateTabSelection(tab) {
    if (!navTabs) return;
    
    const tabs = navTabs.querySelectorAll('.nav-tab');
    tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    
    // Only update if we're changing tabs
    if (currentView !== tab) {
      currentView = tab;
      
      // Toggle content visibility
      const tabContents = document.querySelectorAll('.tab-content');
      tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `${tab}-content`);
      });
      
      const resultsElement = document.getElementById('results');
      const aiSummaryElement = document.getElementById('ai-summary');
      
      // Handle tab-specific display
      if (tab === 'images') {
        // Hide AI summary for images view
        if (aiSummaryElement) {
          aiSummaryElement.style.display = 'none';
        }
        
        // If we have a query, display images for it
        const query = searchBar.value.trim() || new URLSearchParams(window.location.search).get('f');
        if (query && resultsElement) {
          fetchAndDisplayImages(query);
        }
      } else {
        // Show AI summary for search view
        if (aiSummaryElement) {
          aiSummaryElement.style.display = 'block';
        }
        
        // If we have stored results, display them
        if (currentResults && resultsElement) {
          resultsElement.innerHTML = '';
          displayResults(currentResults);
        }
      }
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
        });
      });
    } else {
      // Add click handlers to existing tabs
      const tabs = navTabs.querySelectorAll('.nav-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          updateTabSelection(tab.dataset.tab);
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
    
    // Look for flashtag pattern
    const match = query.match(/^(.*?)\s+!(\w+)$/);
    if (!match) {
      siteInfoTooltip.classList.remove('visible');
      return;
    }

    const tag = match[2].toLowerCase();
    
    // Load sites for Flashtags
    fetch('/sites.json')
      .then(response => response.json())
      .then(sites => {
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
      })
      .catch(error => {
        console.error('Error loading sites:', error);
        siteInfoTooltip.classList.remove('visible');
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
    // First check if we have a query param in the URL
    checkUrlQueryParam();
    
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
      const isResearch = urlParams.get('research') === 'true';
      
      if (queryParam) {
        // Set the search bar value
        if (searchBar) searchBar.value = decodeURIComponent(queryParam);
        
        // Set current view
        currentView = viewParam;
        updateTabSelection(currentView);
        
        // Perform the search only if this isn't a continued search from a previous page
        // or if it's explicitly marked as a research (from clicking a search suggestion)
        if (currentView === 'images') {
          fetchAndDisplayImages(decodeURIComponent(queryParam));
        } else if (!document.referrer.includes('/results') || isResearch) {
          // Only perform the search if we didn't come from another results page
          // or if we're explicitly requesting a new search
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
  
  // Add CSS for new followup components
  function addFollowupStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .followup-container {
        margin-top: 20px;
        padding: 15px;
        background-color: #f9fafb;
        border-radius: 12px;
        border: 1px solid #e5e7eb;
      }
      
      .followup-header {
        font-size: 14px;
        color: #6b7280;
        margin-bottom: 10px;
      }
      
      .followup-input-container {
        display: flex;
      }
      
      .followup-input {
        flex: 1;
        padding: 10px 15px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 14px;
      }
      
      .followup-button {
        margin-left: 10px;
        padding: 10px 15px;
        background-color: #6366f1;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
      }
      
      .followup-button:hover {
        background-color: #4f46e5;
      }
      
      .followup-question {
        margin-top: 20px;
        padding: 10px 15px;
        background-color: #f3f4f6;
        border-radius: 8px;
        border-left: 3px solid #6366f1;
      }
      
      .followup-response {
        margin-top: 10px;
      }
      
      .user-query {
        color: #374151;
      }
    `;
    document.head.appendChild(styleElement);
  }
  
  // Add CSS for images that actually works
  function addImageStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .image-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
        margin-top: 20px;
      }
      
      .google-attribution {
        text-align: right;
        font-size: 12px;
        color: #6b7280;
        margin-bottom: 10px;
      }
      
      .image-card {
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s, box-shadow 0.2s;
        cursor: pointer;
        background-color: white;
        animation: fadeInUp 0.5s forwards;
        opacity: 0;
      }
      
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .image-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
      }
      
      .image-container {
        height: 150px;
        overflow: hidden;
      }
      
      .image-container img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s;
      }
      
      .image-card:hover .image-container img {
        transform: scale(1.05);
      }
      
      .image-title {
        padding: 10px;
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .image-source {
        padding: 0 10px 10px;
        font-size: 12px;
        color: #6b7280;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .image-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s;
      }
      
      .image-modal.visible {
        opacity: 1;
        pointer-events: auto;
      }
      
      .modal-content {
        position: relative;
        max-width: 90%;
        max-height: 90%;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      
      .modal-image {
        max-width: 100%;
        max-height: 80vh;
        object-fit: contain;
        border-radius: 4px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
      }
      
      .modal-title {
        margin-top: 15px;
        color: white;
        text-align: center;
        max-width: 100%;
        font-size: 16px;
      }
      
      .close-modal {
        position: absolute;
        top: -30px;
        right: -30px;
        font-size: 30px;
        color: white;
        cursor: pointer;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background-color: rgba(0, 0, 0, 0.5);
      }
      
      .no-results {
        text-align: center;
        padding: 40px;
        color: #6b7280;
        font-size: 16px;
      }
      
      .error-message {
        text-align: center;
        padding: 40px;
        color: #ef4444;
        font-size: 16px;
      }
    `;
    document.head.appendChild(styleElement);
  }
  
  // Add the followup styles
  addFollowupStyles();
  
  // Add fixed image styles
  addImageStyles();
  
  // Initialize the page
  init();
  
  // Check for URL parameter to handle default search engine redirects
  window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('f');
    
    // If we're on home page with a query parameter, redirect to search results
    if (queryParam && window.location.pathname === '/') {
      const query = decodeURIComponent(queryParam);
      if (searchBar) searchBar.value = query;
      
      // Check if it has a flashtag
      const flashtagMatch = query.match(/^(.*?)\s+!(\w+)$/);
      if (flashtagMatch) {
        // This is a flashtag search
        handleFlashTagSearch(query, flashtagMatch);
      } else {
        // Normal search - redirect to results page
        window.location.href = `/results?f=${encodeURIComponent(query)}`;
      }
    }
  });
  
  // For displaying cached results when switching between tabs
  function showCachedResults() {
    if (currentView === 'search' && currentResults) {
      const resultsElement = document.getElementById('results');
      if (resultsElement) {
        resultsElement.innerHTML = '';
        displayResults(currentResults);
      }
      
      // Show AI summary if available
      const aiSummaryElement = document.getElementById('ai-summary');
      if (aiSummaryElement) {
        aiSummaryElement.style.display = 'block';
      }
    } else if (currentView === 'images' && currentImageResults) {
      const resultsElement = document.getElementById('results');
      if (resultsElement) {
        resultsElement.innerHTML = '';
        displayImageResults(currentImageResults.images);
      }
      
      // Hide AI summary for images
      const aiSummaryElement = document.getElementById('ai-summary');
      if (aiSummaryElement) {
        aiSummaryElement.style.display = 'none';
      }
    }
  }
  
  // Override the updateTabSelection function to use cached results
  function updateTabSelection(tab) {
    if (!navTabs) return;
    
    const tabs = navTabs.querySelectorAll('.nav-tab');
    tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    
    // Only update if we're changing tabs
    if (currentView !== tab) {
      currentView = tab;
      
      // Toggle content visibility
      const tabContents = document.querySelectorAll('.tab-content');
      tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `${tab}-content`);
      });
      
      const aiSummaryElement = document.getElementById('ai-summary');
      
      // Handle tab-specific display using cached results when available
      if (tab === 'images') {
        // Hide AI summary for images view
        if (aiSummaryElement) {
          aiSummaryElement.style.display = 'none';
        }
        
        // Use cached image results if available
        const query = searchBar?.value.trim() || new URLSearchParams(window.location.search).get('f');
        if (query) {
          if (currentImageResults && currentImageResults.query === query) {
            showCachedResults();
          } else {
            fetchAndDisplayImages(query);
          }
        }
      } else {
        // Show AI summary for search view
        if (aiSummaryElement) {
          aiSummaryElement.style.display = 'block';
        }
        
        // Use cached search results if available
        if (currentResults) {
          showCachedResults();
        } else {
          // If no cached results, perform search if we have a query
          const query = searchBar?.value.trim() || new URLSearchParams(window.location.search).get('f');
          if (query) {
            handleStreamingResponse(query);
          }
        }
      }
      
      // Update URL to reflect current view
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.set('view', tab);
      const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  }
  
  // Enhanced image loading with preloading for better performance
  function preloadImages(images, startIndex, count) {
    for (let i = startIndex; i < Math.min(startIndex + count, images.length); i++) {
      const img = new Image();
      img.src = images[i].thumbnail;
    }
  }
  
  // Override displayImageResults to include preloading
  function displayImageResults(images) {
    const resultsElement = document.getElementById('results');
    if (!resultsElement) return;
    
    if (images && images.length > 0) {
      // Create image grid container
      const imageGrid = document.createElement('div');
      imageGrid.className = 'image-grid';
      
      // Add Google attribution
      const attribution = document.createElement('div');
      attribution.className = 'google-attribution';
      attribution.innerHTML = 'Images powered by Google Images';
      resultsElement.appendChild(attribution);
      
      // Add initial batch of images to grid
      const initialBatchSize = 12; // Number of images to show initially
      
      // Preload the first batch of images
      preloadImages(images, 0, initialBatchSize);
      
      // Add all images to grid with staggered loading
      images.forEach((image, index) => {
        const imageCard = document.createElement('div');
        imageCard.className = 'image-card';
        imageCard.style.animationDelay = `${index * 50}ms`;
        
        imageCard.innerHTML = `
          <div class="image-container">
            <img src="${image.thumbnail}" alt="${image.title}" loading="${index < initialBatchSize ? 'eager' : 'lazy'}" />
          </div>
          <div class="image-title">${image.title}</div>
          <div class="image-source">${image.source}</div>
        `;
        
        // Add click handler to open full image
        imageCard.addEventListener('click', () => {
          openImageModal(image.url, image.title);
        });
        
        imageGrid.appendChild(imageCard);
        
        // Preload next batch when initial batch is viewed
        if (index === initialBatchSize - 1) {
          setTimeout(() => {
            preloadImages(images, initialBatchSize, images.length - initialBatchSize);
          }, 1000);
        }
      });
      
      resultsElement.appendChild(imageGrid);
      
      // Implement intersection observer to load images as they come into view
      if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target.querySelector('img');
              if (img && img.dataset.src) {
                img.src = img.dataset.src;
                delete img.dataset.src;
              }
              imageObserver.unobserve(entry.target);
            }
          });
        }, { rootMargin: '200px' });
        
        document.querySelectorAll('.image-card').forEach(card => {
          imageObserver.observe(card);
        });
      }
    } else {
      resultsElement.innerHTML = '<div class="no-results">No images found for your query. Try a different search term.</div>';
    }
  }
  
  // Keyboard navigation for image modal
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('image-modal');
    if (modal && modal.classList.contains('visible')) {
      if (e.key === 'Escape') {
        closeImageModal();
      }
    }
  });
  
  // Function to search for flashtags.tech?f=%s search parameter
  function checkForDefaultSearchParameter() {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.has('f');
  }
  
  // Update the init function to better handle URL parameters
  function enhancedInit() {
    // First check if we have a search parameter
    if (checkForDefaultSearchParameter()) {
      // Get the search parameter
      const urlParams = new URLSearchParams(window.location.search);
      const queryParam = urlParams.get('f');
      
      if (queryParam) {
        // If we're on the homepage, redirect to results
        if (window.location.pathname === '/') {
          window.location.href = `/results?f=${encodeURIComponent(queryParam)}`;
          return;
        }
      }
    }
    
    // Run the original init function
    init();
  }
  
  // Replace init with enhanced version
  const originalInit = init;
  init = enhancedInit;
  
  // Call init to start the page
  enhancedInit();
});
