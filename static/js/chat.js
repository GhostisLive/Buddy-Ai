document.addEventListener('DOMContentLoaded', function() {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatContainer = document.getElementById('chat-container');
    const audioPlayer = document.getElementById('audio-player');
    
    // Use the global audio state from ui.js instead of redefining
    if (window.audioMuted === undefined) {
        window.audioMuted = localStorage.getItem('muted') === 'true' || false;
    }
    
    // Function to get current time formatted
    function getCurrentTime() {
        const now = new Date();
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12;
        hours = hours ? hours : 12; // Hour '0' should be '12'
        
        return `${hours}:${minutes} ${ampm}`;
    }
    
    // Function to add a message to the chat container
    function addMessage(message, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(isUser ? 'user' : 'ai');
        
        // Add user or AI badge
        const badgeDiv = document.createElement('div');
        badgeDiv.classList.add(isUser ? 'user-badge' : 'ai-badge');
        badgeDiv.textContent = isUser ? 'YOU' : 'AI';
        messageDiv.appendChild(badgeDiv);
        
        // Convert markdown for AI messages
        let formattedMessage = message;
        if (!isUser) {
            // Simple markdown conversion for code blocks, links, bold, etc.
            formattedMessage = formattedMessage
                .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        }
        
        // Add the message content
        messageDiv.innerHTML += `<div class="message-content">${formattedMessage}</div>`;
        
        // Add timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = getCurrentTime();
        messageDiv.appendChild(timestamp);
        
        // Add action buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        
        // Add play audio button for AI messages
        if (!isUser) {
            const playAudioBtn = document.createElement('button');
            playAudioBtn.className = 'message-btn play-audio-btn';
            playAudioBtn.innerHTML = '<i class="fa-solid fa-play"></i> PLAY';
            playAudioBtn.title = 'Listen';
            playAudioBtn.dataset.message = message;
            actionsDiv.appendChild(playAudioBtn);
            
            // Add event listener for the audio button
            playAudioBtn.addEventListener('click', function() {
                if (this.dataset.audio) {
                    playAudio(this.dataset.audio);
                    return;
                }
                
                const btn = this;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> LOADING';
                btn.disabled = true;
                
                fetchAudioForText(message).then(audioData => {
                    btn.innerHTML = '<i class="fa-solid fa-play"></i> PLAY';
                    btn.disabled = false;
                    if (audioData) {
                        btn.dataset.audio = audioData;
                        playAudio(audioData);
                    }
                }).catch(() => {
                    btn.innerHTML = '<i class="fa-solid fa-play"></i> PLAY';
                    btn.disabled = false;
                });
            });
        }
        
        // Add copy button for all messages
        const copyBtn = document.createElement('button');
        copyBtn.className = 'message-btn';
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> COPY';
        copyBtn.title = 'Copy text';
        
        copyBtn.addEventListener('click', function() {
            // Get plain text without HTML tags
            const plainText = message.replace(/<[^>]*>/g, '');
            
            navigator.clipboard.writeText(plainText)
                .then(() => {
                    const originalIcon = this.innerHTML;
                    this.innerHTML = '<i class="fa-solid fa-check"></i> COPIED';
                    
                    setTimeout(() => {
                        this.innerHTML = originalIcon;
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy text: ', err);
                });
        });
        
        actionsDiv.appendChild(copyBtn);
        messageDiv.appendChild(actionsDiv);
        
        // Add to chat container and scroll to bottom
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        return messageDiv;
    }
    
    // Function to show typing indicator
    function showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.classList.add('message', 'ai', 'loading');
        indicator.innerHTML = `
            <div class="loading-dots">
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
            </div>
        `;
        indicator.id = 'typing-indicator';
        chatContainer.appendChild(indicator);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        return indicator;
    }
    
    // Function to remove typing indicator
    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    // Function to fetch audio for text
    function fetchAudioForText(text) {
        return fetch('/api/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.audio) {
                console.log("Audio received successfully");
                return data.audio;
            }
            console.warn("No audio data received");
            return null;
        })
        .catch(error => {
            console.error('Error fetching audio:', error);
            return null;
        });
    }
    
    // Function to play audio and animate avatar
    function playAudio(audioSrc) {
        if (!audioSrc || window.audioMuted) return;
        
        // Pause any currently playing audio
        audioPlayer.pause();
        
        // Set new audio source
        audioPlayer.src = audioSrc;
        
        // Update all play buttons to default state first
        const playButtons = document.querySelectorAll('.play-audio-btn');
        playButtons.forEach(btn => {
            btn.innerHTML = '<i class="fa-solid fa-play"></i> PLAY';
            btn.title = "Listen";
        });
        
        // Update current play button to show playing state
        const currentBtn = [...playButtons].find(btn => btn.dataset.audio === audioSrc);
        if (currentBtn) {
            currentBtn.innerHTML = '<i class="fa-solid fa-pause"></i> PAUSE';
            currentBtn.title = "Pause";
        }
        
        // Set speaking status to true when audio starts playing
        audioPlayer.onplay = function() {
            updateAvatarSpeakingState(true);
        };
        
        // Set speaking status to false when audio ends or is paused
        audioPlayer.onended = audioPlayer.onpause = function() {
            // Reset button to play state
            if (currentBtn) {
                currentBtn.innerHTML = '<i class="fa-solid fa-play"></i> PLAY';
                currentBtn.title = "Listen";
            }
            
            updateAvatarSpeakingState(false);
        };
        
        // Play the audio
        audioPlayer.play().catch(error => {
            console.error('Error playing audio:', error);
            updateAvatarSpeakingState(false);
        });
    }
    
    // Handle form submission
    chatForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const message = userInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        addMessage(message, true);
        
        // Clear input and reset height
        userInput.value = '';
        userInput.style.height = 'auto';
        
        // Show typing indicator
        const loadingIndicator = showTypingIndicator();
        
        // Send message to server
        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Remove typing indicator
            removeTypingIndicator();
            
            // Check which field contains the response
            const aiResponse = data.message || data.response || "I'm sorry, I couldn't process your request.";
            
            // Log the response for debugging
            console.log("AI responded with:", aiResponse);
            
            // Add AI response to chat
            const messageElement = addMessage(aiResponse, false);
            
            // If audio data is available, set it up with the play button
            if (data.audio) {
                const audioBtn = messageElement.querySelector('.play-audio-btn');
                if (audioBtn) {
                    audioBtn.dataset.audio = data.audio;
                    
                    // Automatically play the audio if not muted
                    if (!window.audioMuted) {
                        playAudio(data.audio);
                    }
                }
            } else {
                // If no audio data was returned, handle it gracefully
                console.log("No audio data in response, will request it separately");
            }
        })
        .catch(error => {
            console.error('Error:', error);
            removeTypingIndicator();
            addMessage(`CONNECTION ERROR: ${error.message}. Please try again later.`, false);
        });
    });
    
// Update this function in chat.js to make the welcome message more friendly
function addWelcomeMessage() {
    // Check if there are any messages besides the date separator
    const existingMessages = chatContainer.querySelectorAll('.message');
    if (existingMessages.length === 0) {
        const welcomeMessage = "Hey there! I'm your AI BUDDY, ready to chat, help out, or just keep you company. What's on your mind today?";
        const messageElement = addMessage(welcomeMessage, false);
        
        // Set up the audio button for the welcome message
        const audioBtn = messageElement.querySelector('.play-audio-btn');
        if (audioBtn) {
            audioBtn.dataset.message = welcomeMessage;
            
            // Prefetch the welcome message audio
            fetchAudioForText(welcomeMessage)
                .then(audioData => {
                    if (audioData && audioBtn) {
                        audioBtn.dataset.audio = audioData;
                        
                        // Auto-play welcome message if not muted
                        if (!window.audioMuted) {
                            setTimeout(() => playAudio(audioData), 800);
                        }
                    }
                })
                .catch(error => console.error("Failed to prefetch welcome audio:", error));
        }
    }
}
    
    // Listen for welcome message events from ui.js
    document.addEventListener('showWelcomeMessage', addWelcomeMessage);
    
    // Add initial welcome message
    addWelcomeMessage();
});

// Function to update avatar speaking state
function updateAvatarSpeakingState(isSpeaking) {
    // Update avatar if the manager exists
    if (window.avatarManager && typeof window.avatarManager.startTalking === 'function') {
        if (isSpeaking) {
            window.avatarManager.startTalking();
        } else {
            window.avatarManager.stopTalking();
        }
    }
    
    // Update status dot
    const statusDot = document.querySelector('.status-dot');
    if (statusDot) {
        if (isSpeaking) {
            statusDot.classList.add('speaking');
        } else {
            statusDot.classList.remove('speaking');
        }
    }
    
    // Update status text
    const statusText = document.querySelector('.status-text');
    if (statusText) {
        statusText.textContent = isSpeaking ? 'SPEAKING...' : 'ONLINE';
    }
}