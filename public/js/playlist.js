document.addEventListener('DOMContentLoaded', function() {
    const playlistTitle = document.getElementById('playlistTitle');
    const playlistInfo = document.getElementById('playlistInfo');
    const tracksList = document.getElementById('tracksList');
    const noTrackSelected = document.getElementById('noTrackSelected');
    const playerContainer = document.getElementById('playerContainer');
    const currentTrackTitle = document.getElementById('currentTrackTitle');
    const playBtn = document.getElementById('playBtn');
    const timeDisplay = document.getElementById('timeDisplay');
    const waveformContainer = document.getElementById('waveformContainer');
    const waveformPlaceholder = document.getElementById('waveformPlaceholder');
    const commentsToggle = document.getElementById('commentsToggle');
    const commentsContainer = document.getElementById('commentsContainer');

    let playlist = null;
    let currentTrack = null;
    let wavesurfer = null;
    let regions = null;
    let isPlaying = false;
    let showClosedComments = false;
    let allComments = [];

    const playlistUuid = window.location.pathname.split('/playlist/')[1];

    loadPlaylistData();

    playBtn.addEventListener('click', togglePlayPause);
    commentsToggle.addEventListener('click', toggleClosedComments);
    waveformPlaceholder.addEventListener('click', initializeWaveform);

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
                console.error('Error loading playlist:', error);
                showError('Playlist not found or failed to load');
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
        // Clean up previous track
        if (wavesurfer) {
            wavesurfer.destroy();
            wavesurfer = null;
            regions = null;
        }

        // Update UI
        document.querySelectorAll('.track-item').forEach(item => item.classList.remove('active'));
        const trackIndex = playlist.tracks.findIndex(t => t.uuid === track.uuid);
        if (trackIndex >= 0) {
            document.querySelectorAll('.track-item')[trackIndex].classList.add('active');
        }

        currentTrack = track;
        currentTrackTitle.textContent = track.title;

        // Reset player state
        playBtn.disabled = true;
        playBtn.textContent = '▶';
        isPlaying = false;
        timeDisplay.textContent = '00:00 / 00:00';
        waveformPlaceholder.style.display = 'block';
        document.getElementById('waveform').style.display = 'none';
        commentsContainer.innerHTML = '<div class="comments-placeholder">No comments yet. Click on the waveform to add a comment!</div>';

        // Show player
        noTrackSelected.style.display = 'none';
        playerContainer.style.display = 'flex';
    }

    function initializeWaveform() {
        if (wavesurfer || !currentTrack) return;

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

        wavesurfer.load(`/api/track/${currentTrack.uuid}/audio`);

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

        regions.on('region-clicked', function(region, event) {
            event.stopPropagation();
            if (region.commentId) {
                showCommentThread(region.commentId);
            }
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
        if (!currentTrack) return;

        console.log('Loading comment markers...');
        regions.clearRegions();

        return fetch(`/api/track/${currentTrack.uuid}/comments`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load comments');
                }
                return response.json();
            })
            .then(data => {
                allComments = data.comments;
                const rootComments = data.comments.filter(comment => !comment.parent_id);

                rootComments.forEach(comment => {
                    if (!comment.is_closed || showClosedComments) {
                        const region = regions.addRegion({
                            start: comment.timestamp,
                            end: comment.timestamp + 1,
                            color: comment.is_closed ? 'rgba(128, 128, 128, 1)' : 'rgba(255, 0, 0, 1)',
                            drag: false,
                            resize: false,
                            data: { commentId: comment.id }
                        });

                        region.commentId = comment.id;
                    }
                });

                console.log(`Loaded ${rootComments.length} comment markers`);
            })
            .catch(error => {
                console.error('Error loading comments:', error);
            });
    }

    function toggleClosedComments() {
        showClosedComments = !showClosedComments;

        if (showClosedComments) {
            commentsToggle.textContent = 'Hide Closed Comments';
        } else {
            commentsToggle.textContent = 'Show Closed Comments';
        }

        loadCommentMarkers();
    }

    // Import comment functionality from track.js (simplified)
    function showCommentModal(timestamp) {
        if (!currentTrack) return;

        const minutes = Math.floor(timestamp / 60);
        const seconds = Math.floor(timestamp % 60);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        const modalHTML = `
            <div class="modal-overlay" id="commentModal">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title">Add Comment at ${timeStr}</h3>
                        <button class="modal-close" onclick="closeCommentModal()">×</button>
                    </div>
                    <form id="commentForm">
                        <div class="form-group">
                            <label for="commentUsername">Username:</label>
                            <input type="text" id="commentUsername" name="username" value="anonymous" required>
                        </div>
                        <div class="form-group">
                            <label for="commentContent">Comment:</label>
                            <textarea id="commentContent" name="content" placeholder="Enter your comment..." required></textarea>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" onclick="closeCommentModal()">Cancel</button>
                            <button type="submit">Post Comment</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const form = document.getElementById('commentForm');
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            submitComment(timestamp);
        });

        document.getElementById('commentContent').focus();
    }

    function submitComment(timestamp) {
        if (!currentTrack) return;

        const username = document.getElementById('commentUsername').value.trim();
        const content = document.getElementById('commentContent').value.trim();

        if (!username || !content) {
            alert('Please fill in all fields');
            return;
        }

        const submitBtn = document.querySelector('#commentForm button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';

        fetch(`/api/track/${currentTrack.uuid}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                timestamp: timestamp,
                username: username,
                content: content
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to post comment');
            }
            return response.json();
        })
        .then(data => {
            closeCommentModal();
            loadCommentMarkers();
            alert('Comment posted successfully!');
        })
        .catch(error => {
            console.error('Error posting comment:', error);
            alert('Failed to post comment. Please try again.');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post Comment';
        });
    }

    function showCommentThread(commentId) {
        // Simplified comment thread display
        const rootComment = allComments.find(c => c.id === commentId);
        if (!rootComment) return;

        const replies = allComments.filter(c => c.parent_id === commentId);
        const timestamp = formatTime(rootComment.timestamp);

        const threadHTML = `
            <div class="comments-list">
                <h4>Comments at ${timestamp}</h4>
                <div style="margin-top: 15px;">
                    <strong>@${escapeHtml(rootComment.username)}:</strong><br>
                    ${escapeHtml(rootComment.content)}
                    <div style="font-size: 11px; color: #666; margin-top: 5px;">
                        ${new Date(rootComment.created_at).toLocaleString()}
                    </div>
                </div>
                ${replies.map(reply => `
                    <div style="margin-left: 20px; margin-top: 10px; padding-left: 15px; border-left: 2px solid #333;">
                        <strong>@${escapeHtml(reply.username)}:</strong><br>
                        ${escapeHtml(reply.content)}
                        <div style="font-size: 11px; color: #666; margin-top: 5px;">
                            ${new Date(reply.created_at).toLocaleString()}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        commentsContainer.innerHTML = threadHTML;
        commentsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    window.closeCommentModal = function() {
        const modal = document.getElementById('commentModal');
        if (modal) {
            modal.remove();
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;

        playlistTitle.textContent = 'Error';
        playlistInfo.textContent = '';

        const container = document.querySelector('.container');
        container.insertBefore(errorDiv, container.firstChild.nextSibling);
    }
});
