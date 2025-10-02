document.addEventListener('DOMContentLoaded', function() {
    const trackTitle = document.getElementById('trackTitle');
    const trackInfo = document.getElementById('trackInfo');
    const playBtn = document.getElementById('playBtn');
    const timeDisplay = document.getElementById('timeDisplay');
    const waveformContainer = document.getElementById('waveformContainer');
    const waveformPlaceholder = document.getElementById('waveformPlaceholder');
    const commentsToggle = document.getElementById('commentsToggle');
    const commentsContainer = document.getElementById('commentsContainer');

    let currentTrack = null;
    let wavesurfer = null;
    let regions = null;
    let isPlaying = false;
    let showClosedComments = false;

    const trackUuid = window.location.pathname.split('/track/')[1];

    loadTrackData();

    playBtn.addEventListener('click', togglePlayPause);
    commentsToggle.addEventListener('click', toggleClosedComments);
    waveformPlaceholder.addEventListener('click', initializeWaveform);

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

    function initializeWaveform() {
        if (wavesurfer) return;

        waveformPlaceholder.innerHTML = '<div class="loading">Loading waveform...</div>';

        regions = WaveSurfer.Regions.create();

        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: '#666',
            progressColor: '#fff',
            cursorColor: '#fff',
            barWidth: 2,
            barRadius: 3,
            responsive: true,
            height: 120,
            normalize: true,
            plugins: [regions]
        });

        wavesurfer.load(`/api/track/${trackUuid}/audio`);

        wavesurfer.on('ready', function() {
            playBtn.disabled = false;
            waveformPlaceholder.style.display = 'none';
            document.getElementById('waveform').style.display = 'block';
            updateTimeDisplay();
            loadCommentMarkers();
        });

        wavesurfer.on('audioprocess', updateTimeDisplay);
        wavesurfer.on('seek', updateTimeDisplay);

        wavesurfer.on('finish', function() {
            isPlaying = false;
            playBtn.textContent = '▶';
        });

        wavesurfer.on('error', function(error) {
            console.error('WaveSurfer error:', error);
            showError('Failed to load audio file');
            waveformPlaceholder.innerHTML = '<div class="error-message">Failed to load audio</div>';
        });

        wavesurfer.on('click', function(progress, event) {
            const clickTime = progress * wavesurfer.getDuration();
            showCommentModal(clickTime);
        });
    }

    function togglePlayPause() {
        if (!wavesurfer) return;

        if (isPlaying) {
            wavesurfer.pause();
            playBtn.textContent = '▶';
        } else {
            wavesurfer.play();
            playBtn.textContent = '⏸';
        }
        isPlaying = !isPlaying;
    }

    function updateTimeDisplay() {
        if (!wavesurfer) return;

        const current = formatTime(wavesurfer.getCurrentTime());
        const duration = formatTime(wavesurfer.getDuration() || 0);
        timeDisplay.textContent = `${current} / ${duration}`;
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function loadCommentMarkers() {
        // Placeholder - will load actual comments from API
        console.log('Loading comment markers...');

        // Demo: Add a sample comment marker at 30 seconds
        if (wavesurfer.getDuration() > 30) {
            regions.addRegion({
                start: 30,
                end: 30.1,
                color: 'rgba(255, 0, 0, 0.3)',
                drag: false,
                resize: false
            });
        }
    }

    function showCommentModal(timestamp) {
        const minutes = Math.floor(timestamp / 60);
        const seconds = Math.floor(timestamp % 60);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        alert(`Add comment at ${timeStr}\n\nComment modal coming next!`);
    }

    function toggleClosedComments() {
        showClosedComments = !showClosedComments;

        if (showClosedComments) {
            commentsToggle.textContent = 'Hide Closed Comments';
        } else {
            commentsToggle.textContent = 'Show Closed Comments';
        }

        // TODO: Update marker visibility
        console.log('Toggled closed comments:', showClosedComments);
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
