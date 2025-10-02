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
    let allComments = [];

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
        console.log('Loading comment markers...');

        // Clear existing regions
        regions.clearRegions();

        return fetch(`/api/track/${trackUuid}/comments`)
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

    function showCommentModal(timestamp) {
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

    window.closeCommentModal = function() {
        const modal = document.getElementById('commentModal');
        if (modal) {
            modal.remove();
        }
    }

    function submitComment(timestamp) {
        const username = document.getElementById('commentUsername').value.trim();
        const content = document.getElementById('commentContent').value.trim();

        if (!username || !content) {
            alert('Please fill in all fields');
            return;
        }

        const submitBtn = document.querySelector('#commentForm button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';

        fetch(`/api/track/${trackUuid}/comments`, {
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
            loadCommentMarkers(); // Reload to show new comment
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
        const rootComment = allComments.find(c => c.id === commentId);
        if (!rootComment) {
            console.error('Comment not found:', commentId);
            return;
        }

        const replies = allComments.filter(c => c.parent_id === commentId);

        const threadHTML = buildCommentThread(rootComment, replies);
        commentsContainer.innerHTML = threadHTML;

        // Scroll to comments section
        commentsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function buildCommentThread(rootComment, replies) {
        const timestamp = formatTime(rootComment.timestamp);

        return `
            <div class="comments-list">
                <div class="comment-thread">
                    <div class="comment-header">
                        <span class="comment-timestamp">Comments at ${timestamp}</span>
                        <span class="comment-meta">${replies.length + 1} comment${replies.length !== 0 ? 's' : ''}</span>
                    </div>
                    <div class="comment-item">
                        <div class="comment-author">@${escapeHtml(rootComment.username)}</div>
                        <div class="comment-content">${escapeHtml(rootComment.content)}</div>
                        <div class="comment-date">${new Date(rootComment.created_at).toLocaleString()}</div>
                        <div class="comment-actions">
                            <button class="btn-small" onclick="showReplyForm(${rootComment.id})">Reply</button>
                            ${!rootComment.is_closed ? `<button class="btn-small" onclick="closeThread(${rootComment.id})">Close Thread</button>` : ''}
                        </div>
                    </div>
                    ${replies.map(reply => `
                        <div class="comment-item comment-reply">
                            <div class="comment-author">@${escapeHtml(reply.username)}</div>
                            <div class="comment-content">${escapeHtml(reply.content)}</div>
                            <div class="comment-date">${new Date(reply.created_at).toLocaleString()}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    window.showReplyForm = function(commentId) {
        const existingForm = document.getElementById('replyForm');
        if (existingForm) {
            existingForm.remove();
        }

        const modalHTML = `
            <div class="modal-overlay" id="replyModal">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title">Reply to Comment</h3>
                        <button class="modal-close" onclick="closeReplyModal()">×</button>
                    </div>
                    <form id="replyForm">
                        <div class="form-group">
                            <label for="replyUsername">Username:</label>
                            <input type="text" id="replyUsername" name="username" value="anonymous" required>
                        </div>
                        <div class="form-group">
                            <label for="replyContent">Reply:</label>
                            <textarea id="replyContent" name="content" placeholder="Enter your reply..." required></textarea>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" onclick="closeReplyModal()">Cancel</button>
                            <button type="submit">Post Reply</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const form = document.getElementById('replyForm');
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            submitReply(commentId);
        });

        document.getElementById('replyContent').focus();
    }

    window.closeReplyModal = function() {
        const modal = document.getElementById('replyModal');
        if (modal) {
            modal.remove();
        }
    }

    function submitReply(commentId) {
        const username = document.getElementById('replyUsername').value.trim();
        const content = document.getElementById('replyContent').value.trim();

        if (!username || !content) {
            alert('Please fill in all fields');
            return;
        }

        const submitBtn = document.querySelector('#replyForm button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';

        fetch(`/api/track/${trackUuid}/comments/${commentId}/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                content: content
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to post reply');
            }
            return response.json();
        })
        .then(data => {
            closeReplyModal();
            // Reload comments and refresh the thread display
            loadCommentMarkers().then(() => {
                showCommentThread(commentId);
            });
            alert('Reply posted successfully!');
        })
        .catch(error => {
            console.error('Error posting reply:', error);
            alert('Failed to post reply. Please try again.');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post Reply';
        });
    }

    window.closeThread = function(commentId) {
        if (!confirm('Are you sure you want to close this thread? This action cannot be undone.')) {
            return;
        }

        const btn = event.target;
        btn.disabled = true;
        btn.textContent = 'Closing...';

        fetch(`/api/track/${trackUuid}/comments/${commentId}/close`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to close thread');
            }
            return response.json();
        })
        .then(data => {
            // Reload comments and refresh the thread display
            loadCommentMarkers().then(() => {
                showCommentThread(commentId);
            });
            alert('Thread closed successfully!');
        })
        .catch(error => {
            console.error('Error closing thread:', error);
            alert('Failed to close thread. Please try again.');
            btn.disabled = false;
            btn.textContent = 'Close Thread';
        });
    }

    function toggleClosedComments() {
        showClosedComments = !showClosedComments;

        if (showClosedComments) {
            commentsToggle.textContent = 'Hide Closed Comments';
        } else {
            commentsToggle.textContent = 'Show Closed Comments';
        }

        // Reload markers with new visibility setting
        loadCommentMarkers();
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
