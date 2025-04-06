document.addEventListener('DOMContentLoaded', function() {
    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    
    function updateThemeIcon() {
        const isDarkMode = htmlElement.getAttribute('data-theme') === 'dark';
        themeToggle.innerHTML = isDarkMode ? 
            '<i class="fa-solid fa-sun"></i>' : 
            '<i class="fa-solid fa-moon"></i>';
    }
    
    // Initialize theme from localStorage or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    htmlElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon();
    
    // Theme toggle handler
    themeToggle.addEventListener('click', function() {
        const currentTheme = htmlElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        htmlElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        updateThemeIcon();
    });
    
    // Audio mute functionality
    const muteBtn = document.getElementById('mute-btn');
    window.audioMuted = localStorage.getItem('muted') === 'true';
    
    function updateMuteIcon() {
        muteBtn.innerHTML = window.audioMuted ? 
            '<i class="fa-solid fa-volume-xmark"></i>' : 
            '<i class="fa-solid fa-volume-high"></i>';
        
        muteBtn.title = window.audioMuted ? 'Unmute sound' : 'Mute sound';
    }
    
    // Initialize mute button
    updateMuteIcon();
    
    muteBtn.addEventListener('click', function() {
        window.audioMuted = !window.audioMuted;
        localStorage.setItem('muted', window.audioMuted);
        
        updateMuteIcon();
        
        // Stop audio if playing when muted
        if (window.audioMuted) {
            const audioPlayer = document.getElementById('audio-player');
            if (audioPlayer) {
                audioPlayer.pause();
            }
        }
    });
    
    // Reset chat functionality
    const resetBtn = document.getElementById('reset-btn');
    const clearChatBtn = document.getElementById('clear-chat');
    
    function clearChat(preserveWelcome = true) {
        const chatContainer = document.getElementById('chat-container');
        const messages = chatContainer.querySelectorAll('.message');
        
        if (preserveWelcome && messages.length > 0) {
            // Keep only first message if it's from AI (welcome message)
            const firstMessage = messages[0];
            if (firstMessage.classList.contains('ai')) {
                while (chatContainer.childElementCount > 1) {
                    chatContainer.removeChild(chatContainer.lastChild);
                }
            } else {
                chatContainer.innerHTML = '';
            }
        } else {
            chatContainer.innerHTML = '';
        }
        
        // Auto focus input after clearing
        const userInput = document.getElementById('user-input');
        if (userInput) {
            userInput.focus();
        }
    }
    
    resetBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to reset the conversation?')) {
            clearChat(false);
            
            // Add welcome message
            const welcomeEvent = new CustomEvent('showWelcomeMessage');
            document.dispatchEvent(welcomeEvent);
        }
    });
    
    clearChatBtn.addEventListener('click', function() {
        clearChat();
    });
    
    // Auto resize textarea as user types
    const userInput = document.getElementById('user-input');
    
    function autoResizeTextarea() {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    }
    
    userInput.addEventListener('input', autoResizeTextarea);
    
    // Send message when Enter is pressed (unless Shift+Enter)
    userInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            document.getElementById('send-btn').click();
        }
    });
});