class AudioCommentWidget {
    constructor(options) {
        this.options = {
            waveformContainer: '#waveform',
            playButton: null,
            timeDisplay: null,
            commentsContainer: null,
            commentsToggle: null,
            onTrackReady: null,
            onError: null,
            ...options
        };

        this.wavesurfer = null;
        this.regions = null;
        this.isPlaying = false;
        this.showClosedComments = false;
        this.allComments = [];
        this.currentTrackUuid = null;
        this.previewRegion = null;
        this.outsideClickHandler = null;

        this.bindEvents();
    }

    bindEvents() {
        if (this.options.playButton) {
            this.options.playButton.addEventListener('click', () => this.togglePlayPause());
        }

        if (this.options.commentsToggle) {
            this.options.commentsToggle.addEventListener('click', () => this.toggleClosedComments());
        }
    }

    loadTrack(trackUuid) {
        this.currentTrackUuid = trackUuid;
        this.resetPlayer();

        if (this.options.commentsContainer) {
            this.options.commentsContainer.innerHTML = '<div class="comments-placeholder">Loading comments...</div>';
        }

        // Automatically initialize waveform
        this.initializeWaveform();
    }

    resetPlayer() {
        if (this.wavesurfer) {
            this.wavesurfer.destroy();
            this.wavesurfer = null;
            this.regions = null;
        }

        this.isPlaying = false;
        if (this.options.playButton) {
            this.options.playButton.disabled = true;
            this.options.playButton.textContent = '▶';
        }

        if (this.options.timeDisplay) {
            this.options.timeDisplay.textContent = '00:00 / 00:00';
        }

    }

    initializeWaveform() {
        if (this.wavesurfer || !this.currentTrackUuid) return;

        this.regions = WaveSurfer.Regions.create();

        this.wavesurfer = WaveSurfer.create({
            container: this.options.waveformContainer,
            waveColor: '#666',
            progressColor: '#fff',
            cursorColor: '#fff',
            barWidth: 2,
            barRadius: 3,
            responsive: true,
            height: 120,
            normalize: true,
            plugins: [this.regions]
        });

        this.wavesurfer.load(`/api/track/${this.currentTrackUuid}/audio`);

        this.wavesurfer.on('ready', () => {
            if (this.options.playButton) {
                this.options.playButton.disabled = false;
            }

            this.updateTimeDisplay();
            this.loadCommentMarkers();

            if (this.options.onTrackReady) {
                this.options.onTrackReady();
            }
        });

        this.wavesurfer.on('audioprocess', () => this.updateTimeDisplay());
        this.wavesurfer.on('seek', () => this.updateTimeDisplay());

        this.wavesurfer.on('finish', () => {
            this.isPlaying = false;
            if (this.options.playButton) {
                this.options.playButton.textContent = '▶';
            }
        });

        this.wavesurfer.on('error', (error) => {
            console.error('WaveSurfer error:', error);
            const errorMsg = 'Failed to load audio file';

            if (this.options.onError) {
                this.options.onError(errorMsg);
            }
        });

        this.wavesurfer.on('click', (progress, event) => {
            const clickTime = progress * this.wavesurfer.getDuration();
            this.showCommentModal(clickTime);
        });

        this.regions.on('region-clicked', (region, event) => {
            event.stopPropagation();
            if (region.commentId) {
                this.showCommentThread(region.commentId);
            }
        });
    }

    togglePlayPause() {
        if (!this.wavesurfer) return;

        if (this.isPlaying) {
            this.wavesurfer.pause();
            if (this.options.playButton) {
                this.options.playButton.textContent = '▶';
            }
        } else {
            this.wavesurfer.play();
            if (this.options.playButton) {
                this.options.playButton.textContent = '⏸';
            }
        }
        this.isPlaying = !this.isPlaying;
    }

    updateTimeDisplay() {
        if (!this.wavesurfer || !this.options.timeDisplay) return;

        const current = this.formatTime(this.wavesurfer.getCurrentTime());
        const duration = this.formatTime(this.wavesurfer.getDuration() || 0);
        this.options.timeDisplay.textContent = `${current} / ${duration}`;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    loadCommentMarkers() {
        if (!this.currentTrackUuid) return;

        console.log('Loading comment markers...');
        this.regions.clearRegions();

        return fetch(`/api/track/${this.currentTrackUuid}/comments`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load comments');
                }
                return response.json();
            })
            .then(data => {
                this.allComments = data.comments;
                const rootComments = data.comments.filter(comment => !comment.parent_id);

                // Add markers to waveform
                rootComments.forEach(comment => {
                    if (!comment.is_closed || this.showClosedComments) {
                        const region = this.regions.addRegion({
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

                // Display all comments in collapsed view
                this.displayAllComments();

                console.log(`Loaded ${rootComments.length} comment markers`);
            })
            .catch(error => {
                console.error('Error loading comments:', error);
                if (this.options.commentsContainer) {
                    this.options.commentsContainer.innerHTML = '<div class="error-message">Failed to load comments</div>';
                }
            });
    }

    displayAllComments() {
        if (!this.options.commentsContainer) return;

        // Filter comments based on showClosedComments flag
        const rootComments = this.allComments.filter(c => !c.parent_id && (!c.is_closed || this.showClosedComments));

        if (rootComments.length === 0) {
            const message = this.showClosedComments
                ? 'No comments yet. Click on the waveform to add a comment!'
                : 'No open comments. Toggle "Show Closed Comments" to see all comments.';
            this.options.commentsContainer.innerHTML = `<div class="comments-placeholder">${message}</div>`;
            return;
        }

        const commentsHTML = rootComments.map(comment => {
            const replies = this.allComments.filter(c => c.parent_id === comment.id);
            const replyCount = replies.length;
            const preview = comment.content.length > 50 ? comment.content.substring(0, 50) + '...' : comment.content;
            const timestamp = this.formatTime(comment.timestamp);
            const closedBadge = comment.is_closed ? '<span class="closed-badge">Closed</span>' : '';

            return `
                <div class="comment-summary ${comment.is_closed ? 'comment-closed' : ''}" data-comment-id="${comment.id}">
                    <div class="comment-summary-header">
                        <span class="comment-summary-time">${timestamp} ${closedBadge}</span>
                        <span class="comment-summary-meta">@${this.escapeHtml(comment.username)} • ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}</span>
                    </div>
                    <div class="comment-summary-preview">${this.escapeHtml(preview)}</div>
                    <div class="comment-summary-actions">
                        <button class="btn-small goto-btn" onclick="window.audioWidget.seekToComment(${comment.id})">Goto</button>
                        <button class="btn-small open-btn" onclick="window.audioWidget.expandCommentThread(${comment.id})">Open</button>
                    </div>
                </div>
            `;
        }).join('');

        this.options.commentsContainer.innerHTML = `<div class="comments-list">${commentsHTML}</div>`;
    }

    seekToComment(commentId) {
        const comment = this.allComments.find(c => c.id === commentId);
        if (comment && this.wavesurfer) {
            this.wavesurfer.seekTo(comment.timestamp / this.wavesurfer.getDuration());
        }
    }

    expandCommentThread(commentId) {
        this.showCommentThread(commentId);
    }

    showCommentModal(timestamp) {
        const minutes = Math.floor(timestamp / 60);
        const seconds = Math.floor(timestamp % 60);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Show the inline form
        const inlineForm = document.getElementById('inlineCommentForm');
        const timestampSpan = document.getElementById('commentTimestamp');
        const usernameInput = document.getElementById('commentUsername');
        const contentTextarea = document.getElementById('commentContent');
        const form = document.getElementById('commentForm');

        if (!inlineForm) return;

        // Set timestamp
        timestampSpan.textContent = timeStr;

        // Reset form - use saved username from localStorage or default to 'anonymous'
        const savedUsername = localStorage.getItem('commentUsername') || 'anonymous';
        usernameInput.value = savedUsername;
        contentTextarea.value = '';

        // Show form with animation
        inlineForm.style.display = 'block';

        // Add temporary preview region on waveform
        this.addPreviewRegion(timestamp);

        // Setup event handlers
        const cancelBtn1 = document.getElementById('cancelCommentBtn');
        const cancelBtn2 = document.getElementById('cancelCommentBtn2');

        const closeHandler = () => this.closeCommentModal();
        cancelBtn1.onclick = closeHandler;
        cancelBtn2.onclick = closeHandler;

        // Remove old submit handler and add new one
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitComment(timestamp);
        });

        // Click outside to close
        this.setupOutsideClickHandler(inlineForm);

        // Focus on textarea
        contentTextarea.focus();

        // Scroll to form
        inlineForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    addPreviewRegion(timestamp) {
        // Remove any existing preview region
        this.removePreviewRegion();

        // Create temporary preview region with distinct styling
        if (this.regions) {
            this.previewRegion = this.regions.addRegion({
                start: timestamp,
                end: timestamp + 1,
                color: 'rgba(255, 255, 0, 0.6)', // Yellow, semi-transparent
                drag: false,
                resize: false,
                data: { isPreview: true }
            });
        }
    }

    removePreviewRegion() {
        if (this.previewRegion) {
            this.previewRegion.remove();
            this.previewRegion = null;
        }
    }

    setupOutsideClickHandler(formElement) {
        // Remove any existing handler
        if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler);
        }

        // Create new handler
        this.outsideClickHandler = (event) => {
            if (!formElement.contains(event.target)) {
                this.closeCommentModal();
            }
        };

        // Add handler after a small delay to avoid immediate closure from the click that opened it
        setTimeout(() => {
            document.addEventListener('click', this.outsideClickHandler);
        }, 100);
    }

    closeCommentModal() {
        const inlineForm = document.getElementById('inlineCommentForm');
        if (inlineForm) {
            inlineForm.style.display = 'none';
        }

        // Remove preview region from waveform
        this.removePreviewRegion();

        // Remove outside click handler
        if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler);
            this.outsideClickHandler = null;
        }
    }

    submitComment(timestamp) {
        const username = document.getElementById('commentUsername').value.trim();
        const content = document.getElementById('commentContent').value.trim();

        if (!username || !content) {
            alert('Please fill in all fields');
            return;
        }

        // Save username to localStorage for future use
        localStorage.setItem('commentUsername', username);

        const submitBtn = document.querySelector('#commentForm button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';

        fetch(`/api/track/${this.currentTrackUuid}/comments`, {
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
            this.removePreviewRegion(); // Remove preview before reloading markers
            this.closeCommentModal();
            this.loadCommentMarkers(); // This will reload and display all comments
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

    showCommentThread(commentId) {
        const rootComment = this.allComments.find(c => c.id === commentId);
        if (!rootComment) {
            console.error('Comment not found:', commentId);
            return;
        }

        const replies = this.allComments.filter(c => c.parent_id === commentId);
        const threadHTML = this.buildCommentThread(rootComment, replies);

        if (this.options.commentsContainer) {
            // Add back button to return to list view
            const backButton = '<button class="btn-secondary" onclick="window.audioWidget.displayAllComments()" style="margin-bottom: 15px;">← Back to all comments</button>';
            this.options.commentsContainer.innerHTML = backButton + threadHTML;
            this.options.commentsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    buildCommentThread(rootComment, replies) {
        const timestamp = this.formatTime(rootComment.timestamp);

        return `
            <div class="comments-list">
                <div class="comment-thread">
                    <div class="comment-header">
                        <span class="comment-timestamp">Comments at ${timestamp}</span>
                        <span class="comment-meta">${replies.length + 1} comment${replies.length !== 0 ? 's' : ''}</span>
                    </div>
                    <div class="comment-item">
                        <div class="comment-author">@${this.escapeHtml(rootComment.username)}</div>
                        <div class="comment-content">${this.escapeHtml(rootComment.content)}</div>
                        <div class="comment-date">${new Date(rootComment.created_at).toLocaleString()}</div>
                        <div class="comment-actions">
                            <button class="btn-small" onclick="window.audioWidget.showReplyForm(${rootComment.id})">Reply</button>
                            ${!rootComment.is_closed ? `<button class="btn-small" onclick="window.audioWidget.closeThread(${rootComment.id})">Close Thread</button>` : ''}
                        </div>
                    </div>
                    ${replies.map(reply => `
                        <div class="comment-item comment-reply">
                            <div class="comment-author">@${this.escapeHtml(reply.username)}</div>
                            <div class="comment-content">${this.escapeHtml(reply.content)}</div>
                            <div class="comment-date">${new Date(reply.created_at).toLocaleString()}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    showReplyForm(commentId) {
        const existingForm = document.getElementById('replyForm');
        if (existingForm) {
            existingForm.remove();
        }

        // Get saved username from localStorage or default to 'anonymous'
        const savedUsername = localStorage.getItem('commentUsername') || 'anonymous';

        const modalHTML = `
            <div class="modal-overlay" id="replyModal">
                <div class="modal">
                    <div class="modal-header">
                        <h3 class="modal-title">Reply to Comment</h3>
                        <button class="modal-close" onclick="window.audioWidget.closeReplyModal()">×</button>
                    </div>
                    <form id="replyForm">
                        <div class="form-group">
                            <label for="replyUsername">Username:</label>
                            <input type="text" id="replyUsername" name="username" value="${this.escapeHtml(savedUsername)}" required>
                        </div>
                        <div class="form-group">
                            <label for="replyContent">Reply:</label>
                            <textarea id="replyContent" name="content" placeholder="Enter your reply..." required></textarea>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" onclick="window.audioWidget.closeReplyModal()">Cancel</button>
                            <button type="submit">Post Reply</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const form = document.getElementById('replyForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitReply(commentId);
        });

        document.getElementById('replyContent').focus();
    }

    closeReplyModal() {
        const modal = document.getElementById('replyModal');
        if (modal) {
            modal.remove();
        }
    }

    submitReply(commentId) {
        const username = document.getElementById('replyUsername').value.trim();
        const content = document.getElementById('replyContent').value.trim();

        if (!username || !content) {
            alert('Please fill in all fields');
            return;
        }

        // Save username to localStorage for future use
        localStorage.setItem('commentUsername', username);

        const submitBtn = document.querySelector('#replyForm button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';

        fetch(`/api/track/${this.currentTrackUuid}/comments/${commentId}/reply`, {
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
            this.closeReplyModal();
            this.loadCommentMarkers().then(() => {
                this.showCommentThread(commentId); // Stay on expanded thread after reply
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

    closeThread(commentId) {
        if (!confirm('Are you sure you want to close this thread? This action cannot be undone.')) {
            return;
        }

        const btn = event.target;
        btn.disabled = true;
        btn.textContent = 'Closing...';

        fetch(`/api/track/${this.currentTrackUuid}/comments/${commentId}/close`, {
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
            this.loadCommentMarkers(); // Return to list view after closing
            alert('Thread closed successfully!');
        })
        .catch(error => {
            console.error('Error closing thread:', error);
            alert('Failed to close thread. Please try again.');
            btn.disabled = false;
            btn.textContent = 'Close Thread';
        });
    }

    toggleClosedComments() {
        this.showClosedComments = !this.showClosedComments;

        if (this.options.commentsToggle) {
            if (this.showClosedComments) {
                this.options.commentsToggle.textContent = 'Hide Closed Comments';
            } else {
                this.options.commentsToggle.textContent = 'Show Closed Comments';
            }
        }

        // Reload markers and refresh comment list
        this.loadCommentMarkers();
        console.log('Toggled closed comments:', this.showClosedComments);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        if (this.wavesurfer) {
            this.wavesurfer.destroy();
            this.wavesurfer = null;
            this.regions = null;
        }
    }
}

// Make widget globally accessible for modal callbacks
window.AudioCommentWidget = AudioCommentWidget;
