document.addEventListener('DOMContentLoaded', function() {
    const playlistTitle = document.getElementById('playlistTitle');
    const playlistInfo = document.getElementById('playlistInfo');
    const tracksList = document.getElementById('tracksList');
    const noTrackSelected = document.getElementById('noTrackSelected');
    const playerContainer = document.getElementById('playerContainer');
    const currentTrackTitle = document.getElementById('currentTrackTitle');
    const playBtn = document.getElementById('playBtn');
    const timeDisplay = document.getElementById('timeDisplay');
    const waveformPlaceholder = document.getElementById('waveformPlaceholder');
    const commentsToggle = document.getElementById('commentsToggle');
    const commentsContainer = document.getElementById('commentsContainer');

    let playlist = null;
    let currentTrack = null;

    const playlistUuid = extractUuidFromPath('playlist');

    const audioWidget = new AudioCommentWidget({
        waveformContainer: '#waveform',
        waveformPlaceholder: waveformPlaceholder,
        playButton: playBtn,
        timeDisplay: timeDisplay,
        commentsContainer: commentsContainer,
        commentsToggle: commentsToggle,
        onTrackReady: () => {
            console.log('Track ready in playlist widget');
        },
        onError: (message) => {
            showError(message, playlistTitle, playlistInfo);
        }
    });

    // Make widget globally accessible for modal callbacks
    window.audioWidget = audioWidget;

    loadPlaylistData();

    function loadPlaylistData() {
        fetch(`/api/playlist/${playlistUuid}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Playlist not found');
                }
                return response.json();
            })
            .then(data => {
                playlist = data.playlist;
                displayPlaylistInfo();
                displayTracks();
                if (playlist.tracks.length > 0) {
                    selectTrack(playlist.tracks[0]);
                }
            })
            .catch(error => {
                showError(handleFetchError(error, 'Playlist not found or failed to load'), playlistTitle, playlistInfo);
            });
    }

    function displayPlaylistInfo() {
        playlistTitle.textContent = playlist.title;
        playlistInfo.textContent = `${playlist.tracks.length} tracks • Created: ${new Date(playlist.created_at).toLocaleDateString()}`;
    }

    function displayTracks() {
        if (playlist.tracks.length === 0) {
            tracksList.innerHTML = '<div class="loading">No tracks in this playlist</div>';
            return;
        }

        tracksList.innerHTML = '';
        playlist.tracks.forEach((track, index) => {
            const trackElement = document.createElement('div');
            trackElement.className = 'track-item';
            trackElement.innerHTML = `
                <div class="track-title">${escapeHtml(track.title)}</div>
                <div class="track-meta">Track ${index + 1}</div>
            `;
            trackElement.addEventListener('click', () => selectTrack(track));
            tracksList.appendChild(trackElement);
        });
    }

    function selectTrack(track) {
        document.querySelectorAll('.track-item').forEach(item => item.classList.remove('active'));
        const trackIndex = playlist.tracks.findIndex(t => t.uuid === track.uuid);
        if (trackIndex >= 0) {
            document.querySelectorAll('.track-item')[trackIndex].classList.add('active');
        }

        currentTrack = track;
        currentTrackTitle.textContent = track.title;

        audioWidget.loadTrack(track.uuid);

        // Show player
        noTrackSelected.style.display = 'none';
        playerContainer.style.display = 'flex';
    }

});
