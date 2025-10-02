document.addEventListener('DOMContentLoaded', function() {
    const trackTitle = document.getElementById('trackTitle');
    const trackInfo = document.getElementById('trackInfo');
    const playBtn = document.getElementById('playBtn');
    const timeDisplay = document.getElementById('timeDisplay');
    const waveformPlaceholder = document.getElementById('waveformPlaceholder');
    const commentsToggle = document.getElementById('commentsToggle');
    const commentsContainer = document.getElementById('commentsContainer');

    let currentTrack = null;

    const trackUuid = window.location.pathname.split('/track/')[1];

    // Initialize the reusable audio comment widget
    const audioWidget = new AudioCommentWidget({
        waveformContainer: '#waveform',
        waveformPlaceholder: waveformPlaceholder,
        playButton: playBtn,
        timeDisplay: timeDisplay,
        commentsContainer: commentsContainer,
        commentsToggle: commentsToggle,
        onTrackReady: () => {
            console.log('Track ready in widget');
        },
        onError: (message) => {
            showError(message);
        }
    });

    // Make widget globally accessible for modal callbacks
    window.audioWidget = audioWidget;

    loadTrackData();

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
                audioWidget.loadTrack(trackUuid);
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