document.addEventListener('DOMContentLoaded', function() {
    const trackTitle = document.getElementById('trackTitle');
    const trackInfo = document.getElementById('trackInfo');
    const playBtn = document.getElementById('playBtn');
    const timeDisplay = document.getElementById('timeDisplay');
    const commentsToggle = document.getElementById('commentsToggle');
    const commentsContainer = document.getElementById('commentsContainer');

    let currentTrack = null;

    const trackUuid = extractUuidFromPath('track');

    const audioWidget = new AudioCommentWidget({
        waveformContainer: '#waveform',
        playButton: playBtn,
        timeDisplay: timeDisplay,
        commentsContainer: commentsContainer,
        commentsToggle: commentsToggle,
        onTrackReady: () => {
            console.log('Track ready in widget');
        },
        onError: (message) => {
            showError(message, trackTitle, trackInfo);
        }
    });

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
                showError(handleFetchError(error, 'Track not found or failed to load'), trackTitle, trackInfo);
            });
    }

    function displayTrackInfo() {
        trackTitle.textContent = currentTrack.title;
        trackInfo.textContent = `UUID: ${currentTrack.uuid} • Created: ${new Date(currentTrack.created_at).toLocaleDateString()}`;
    }
});
