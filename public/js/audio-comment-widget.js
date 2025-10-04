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
        this.hover = null;
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

        if (this.options.commentsContainer) {
            this.options.commentsContainer.addEventListener('click', (e) => {
                const target = e.target;

                if (target.classList.contains('goto-btn')) {
                    const commentId = parseInt(target.closest('.comment-summary').dataset.commentId);
                    this.seekToComment(commentId);
                }

                if (target.classList.contains('open-btn')) {
                    const commentId = parseInt(target.closest('.comment-summary').dataset.commentId);
                    this.expandCommentThread(commentId);
                }

                if (target.classList.contains('back-to-list-btn')) {
                    this.displayAllComments();
                }

                if (target.classList.contains('reply-btn')) {
                    const commentId = parseInt(target.dataset.commentId);
                    this.showReplyForm(commentId);
                }

                if (target.classList.contains('close-thread-btn')) {
                    const commentId = parseInt(target.dataset.commentId);
                    this.closeThread(commentId);
                }
            });
        }
    }

    loadTrack(trackUuid) {
        this.currentTrackUuid = trackUuid;
        this.resetPlayer();

        if (this.options.commentsContainer) {
            this.options.commentsContainer.innerHTML = '<div class="comments-placeholder">Loading comments...</div>';
        }

        this.initializeWaveform();
    }

    resetPlayer() {
        if (this.wavesurfer) {
            this.wavesurfer.destroy();
            this.wavesurfer = null;
            this.regions = null;
            this.hover = null;
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
        this.hover = WaveSurfer.Hover.create({
            lineColor: '#fff',
            lineWidth: 2,
            labelBackground: '#555',
            labelColor: '#fff',
            labelSize: '11px',
            labelPreferLeft: false,
        });

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
            plugins: [
                this.regions,
                this.hover
            ]
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

                rootComments.forEach(comment => {
                    if (!comment.is_closed || this.showClosedComments) {
                        const region = this.regions.addRegion({
                            start: comment.timestamp,
                            color: comment.is_closed ? 'rgba(128, 128, 128, 1)' : 'rgba(255, 0, 0, 1)',
                            drag: false,
                            resize: false,
                            data: { commentId: comment.id }
                        });

                        region.commentId = comment.id;
                    }
                });

                this.displayAllComments();
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

        const rootComments = this.allComments.filter(c => !c.parent_id && (!c.is_closed || this.showClosedComments));

        if (rootComments.length === 0) {
            const message = this.showClosedComments
                ? 'No comments yet. Click on the waveform to add a comment!'
                : 'No open comments. Toggle "Show Closed Comments" to see all comments.';
            this.options.commentsContainer.innerHTML = `<div class="comments-placeholder">${message}</div>`;
            return;
        }

        const template = document.getElementById('comment-summary-template');
        const listContainer = document.createElement('div');
        listContainer.className = 'comments-list';

        rootComments.forEach(comment => {
            const replies = this.allComments.filter(c => c.parent_id === comment.id);
            const replyCount = replies.length;
            const preview = comment.content.length > 50 ? comment.content.substring(0, 50) + '...' : comment.content;
            const timestamp = this.formatTime(comment.timestamp);
            const closedBadge = comment.is_closed ? '<span class="closed-badge">Closed</span>' : '';

            const summaryEl = template.content.cloneNode(true);
            const summaryDiv = summaryEl.querySelector('.comment-summary');

            summaryDiv.dataset.commentId = comment.id;
            if (comment.is_closed) {
                summaryDiv.classList.add('comment-closed');
            }

            summaryEl.querySelector('.comment-summary-time').innerHTML = `${timestamp} ${closedBadge}`;
            summaryEl.querySelector('.comment-summary-meta').textContent = `@${comment.username} • ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;
            summaryEl.querySelector('.comment-summary-preview').textContent = preview;

            listContainer.appendChild(summaryEl);
        });

        this.options.commentsContainer.innerHTML = '';
        this.options.commentsContainer.appendChild(listContainer);
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

        const inlineForm = document.getElementById('inlineCommentForm');
        const timestampSpan = document.getElementById('commentTimestamp');
        const usernameInput = document.getElementById('commentUsername');
        const contentTextarea = document.getElementById('commentContent');
        const form = document.getElementById('commentForm');

        if (!inlineForm) return;

        timestampSpan.textContent = timeStr;

        const savedUsername = localStorage.getItem('commentUsername') || 'anonymous';
        usernameInput.value = savedUsername;
        contentTextarea.value = '';

        inlineForm.classList.remove('hidden');

        this.addPreviewRegion(timestamp);

        const cancelBtn1 = document.getElementById('cancelCommentBtn');
        const cancelBtn2 = document.getElementById('cancelCommentBtn2');

        const closeHandler = () => this.closeCommentModal();
        cancelBtn1.onclick = closeHandler;
        cancelBtn2.onclick = closeHandler;

        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitComment(timestamp);
        });

        this.setupOutsideClickHandler(inlineForm);

        contentTextarea.focus();

        inlineForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    addPreviewRegion(timestamp) {
        this.removePreviewRegion();

        if (this.regions) {
            this.previewRegion = this.regions.addRegion({
                start: timestamp,
                color: 'rgba(255, 255, 0, 0.6)',
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
        if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler);
        }

        this.outsideClickHandler = (event) => {
            if (!formElement.contains(event.target)) {
                this.closeCommentModal();
            }
        };

        setTimeout(() => {
            document.addEventListener('click', this.outsideClickHandler);
        }, 100);
    }

    closeCommentModal() {
        const inlineForm = document.getElementById('inlineCommentForm');
        if (inlineForm) {
            inlineForm.classList.add('hidden');
        }

        this.removePreviewRegion();

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
            this.removePreviewRegion();
            this.closeCommentModal();
            this.loadCommentMarkers();
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
        const threadElement = this.buildCommentThread(rootComment, replies);

        if (this.options.commentsContainer) {
            this.options.commentsContainer.innerHTML = '';
            this.options.commentsContainer.appendChild(threadElement);
            this.options.commentsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    buildCommentThread(rootComment, replies) {
        const timestamp = this.formatTime(rootComment.timestamp);
        const template = document.getElementById('comment-thread-template');
        const threadEl = template.content.cloneNode(true);

        threadEl.querySelector('.comment-timestamp').textContent = `Comments at ${timestamp}`;
        threadEl.querySelector('.comment-meta').textContent = `${replies.length + 1} comment${replies.length !== 0 ? 's' : ''}`;

        threadEl.querySelector('.comment-author').textContent = `@${rootComment.username}`;
        threadEl.querySelector('.comment-content').textContent = rootComment.content;
        threadEl.querySelector('.comment-date').textContent = new Date(rootComment.created_at).toLocaleString();

        const replyBtn = threadEl.querySelector('.reply-btn');
        const closeThreadBtn = threadEl.querySelector('.close-thread-btn');

        replyBtn.dataset.commentId = rootComment.id;

        if (!rootComment.is_closed) {
            closeThreadBtn.classList.remove('hidden');
            closeThreadBtn.dataset.commentId = rootComment.id;
        }

        const repliesContainer = threadEl.querySelector('.replies-container');
        const replyTemplate = document.getElementById('comment-reply-template');

        replies.forEach(reply => {
            const replyEl = replyTemplate.content.cloneNode(true);
            replyEl.querySelector('.comment-author').textContent = `@${reply.username}`;
            replyEl.querySelector('.comment-content').textContent = reply.content;
            replyEl.querySelector('.comment-date').textContent = new Date(reply.created_at).toLocaleString();
            repliesContainer.appendChild(replyEl);
        });

        return threadEl;
    }

    showReplyForm(commentId) {
        const existingForm = document.getElementById('replyForm');
        if (existingForm) {
            existingForm.remove();
        }

        const savedUsername = localStorage.getItem('commentUsername') || 'anonymous';

        const template = document.getElementById('reply-modal-template');
        const modal = template.content.cloneNode(true);

        modal.getElementById('replyUsername').value = savedUsername;

        const modalClose = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.cancel-reply-btn');
        const form = modal.getElementById('replyForm');

        modalClose.onclick = () => this.closeReplyModal();
        cancelBtn.onclick = () => this.closeReplyModal();
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitReply(commentId);
        });

        document.body.appendChild(modal);

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
                this.showCommentThread(commentId);
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
            this.loadCommentMarkers();
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

        this.loadCommentMarkers();
    }

    destroy() {
        if (this.wavesurfer) {
            this.wavesurfer.destroy();
            this.wavesurfer = null;
            this.regions = null;
            this.hover = null;
        }
    }
}

window.AudioCommentWidget = AudioCommentWidget;
