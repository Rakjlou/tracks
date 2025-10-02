document.addEventListener('DOMContentLoaded', function() {
    const trackTitle = document.getElementById('trackTitle');
    const trackInfo = document.getElementById('trackInfo');
    const playBtn = document.getElementById('playBtn');
    const timeDisplay = document.getElementById('timeDisplay');
    const waveformContainer = document.getElementById('waveformContainer');
    const commentsToggle = document.getElementById('commentsToggle');
    const commentsContainer = document.getElementById('commentsContainer');

    let currentTrack = null;
    let audioElement = null;
    let isPlaying = false;

    const trackUuid = window.location.pathname.split('/track/')[1];

    loadTrackData();

    playBtn.addEventListener('click', togglePlayPause);
    commentsToggle.addEventListener('click', toggleClosedComments);
    waveformContainer.addEventListener('click', initializeAudio);

    function loadTrackData() {
        fetch(`/api/track/${trackUuid}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Track not found');
                }
                return response.json();
            })
            .then(data => {
                currentTrack = data.track;
                displayTrackInfo();
            })
            .catch(error => {
                console.error('Error loading track:', error);
                showError('Track not found or failed to load');
            });
    }

    function displayTrackInfo() {
        trackTitle.textContent = currentTrack.title;
        trackInfo.textContent = `UUID: ${currentTrack.uuid} • Created: ${new Date(currentTrack.created_at).toLocaleDateString()}`;
    }

    function initializeAudio() {
        if (audioElement) return;

        waveformContainer.innerHTML = '<div class="loading">Loading audio...</div>';

        audioElement = new Audio(`/api/track/${trackUuid}/audio`);
        
        audioElement.addEventListener('loadedmetadata', function() {
            playBtn.disabled = false;
            updateTimeDisplay();
            waveformContainer.innerHTML = '<div class="waveform-placeholder" style="background: #111;">Simple waveform placeholder - WaveSurfer.js integration coming next!</div>';
        });

        audioElement.addEventListener('timeupdate', updateTimeDisplay);
        
        audioElement.addEventListener('ended', function() {
            isPlaying = false;
            playBtn.textContent = '▶';
        });

        audioElement.addEventListener('error', function() {
            showError('Failed to load audio file');
            waveformContainer.innerHTML = '<div class="error-message">Failed to load audio</div>';
        });
    }

    function togglePlayPause() {
        if (!audioElement) return;

        if (isPlaying) {
            audioElement.pause();
            playBtn.textContent = '▶';
        } else {
            audioElement.play();
            playBtn.textContent = '⏸';
        }
        isPlaying = !isPlaying;
    }

    function updateTimeDisplay() {
        if (!audioElement) return;

        const current = formatTime(audioElement.currentTime);
        const duration = formatTime(audioElement.duration || 0);
        timeDisplay.textContent = `${current} / ${duration}`;
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function toggleClosedComments() {
        // Placeholder for closed comments toggle
        if (commentsToggle.textContent.includes('Show')) {
            commentsToggle.textContent = 'Hide Closed Comments';
        } else {
            commentsToggle.textContent = 'Show Closed Comments';
        }
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        trackTitle.textContent = 'Error';
        trackInfo.textContent = '';
        
        const container = document.querySelector('.container');
        container.insertBefore(errorDiv, container.firstChild.nextSibling);
    }
});