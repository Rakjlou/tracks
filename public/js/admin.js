document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('uploadForm');
    const tracksContainer = document.getElementById('tracksContainer');
    const playlistForm = document.getElementById('playlistForm');
    const playlistsContainer = document.getElementById('playlistsContainer');

    loadTracks();
    loadPlaylists();

    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        uploadTrack();
    });

    playlistForm.addEventListener('submit', function(e) {
        e.preventDefault();
        createPlaylist();
    });

    function loadTracks() {
        fetch('/admin/tracks')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load tracks');
                }
                return response.json();
            })
            .then(data => {
                displayTracks(data.tracks);
            })
            .catch(error => {
                console.error('Error loading tracks:', error);
                tracksContainer.innerHTML = '<div class="empty-state">Error loading tracks</div>';
            });
    }

    function displayTracks(tracks) {
        if (tracks.length === 0) {
            tracksContainer.innerHTML = '<div class="empty-state">No tracks uploaded yet</div>';
            return;
        }

        const tableTemplate = document.getElementById('track-table-template');
        const table = tableTemplate.content.cloneNode(true).querySelector('table');
        const tbody = table.querySelector('tbody');

        tracks.forEach(track => {
            const rowTemplate = document.getElementById('track-row-template');
            const row = rowTemplate.content.cloneNode(true);

            row.querySelector('tr').id = `track-row-${track.id}`;
            row.querySelector('.track-title').textContent = track.title;
            row.querySelector('.track-uuid').textContent = track.uuid;
            row.querySelector('.track-uuid').href = `/track/${track.uuid}`;
            row.querySelector('.track-filename').textContent = track.filename;
            row.querySelector('.track-protection').id = `track-protection-${track.id}`;
            row.querySelector('.track-created').textContent = new Date(track.created_at).toLocaleString();

            const editBtn = row.querySelector('.edit-btn');
            const deleteBtn = row.querySelector('.delete-btn');
            editBtn.onclick = () => editTrack(track.id);
            deleteBtn.onclick = () => deleteTrack(track.id);

            tbody.appendChild(row);
        });

        tracksContainer.innerHTML = '';
        tracksContainer.appendChild(table);

        tracks.forEach(track => {
            loadTrackCredentialStatus(track.id);
        });
    }

    function uploadTrack() {
        const formData = new FormData(uploadForm);
        const submitButton = uploadForm.querySelector('button[type="submit"]');

        submitButton.disabled = true;
        submitButton.textContent = 'Uploading...';

        fetch('/admin/tracks', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Upload failed');
            }
            return response.json();
        })
        .then(data => {
            alert('Track uploaded successfully!');
            uploadForm.reset();
            loadTracks();
        })
        .catch(error => {
            console.error('Error uploading track:', error);
            alert('Error uploading track. Please try again.');
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = 'Upload Track';
        });
    }

    function loadTrackCredentialStatus(trackId) {
        fetch(`/admin/tracks/${trackId}/credentials`)
            .then(response => response.json())
            .then(data => {
                const statusCell = document.getElementById(`track-protection-${trackId}`);
                if (data.hasCredentials) {
                    statusCell.innerHTML = `<span class="credentials-status credentials-protected">Private</span>`;
                } else {
                    statusCell.innerHTML = `<span class="credentials-status credentials-unprotected">Public</span>`;
                }
            })
            .catch(error => {
                console.error('Error loading credential status:', error);
                const statusCell = document.getElementById(`track-protection-${trackId}`);
                statusCell.innerHTML = '<span class="credentials-status credentials-unprotected">Error</span>';
            });
    }


    window.editTrack = function(trackId) {
        fetch(`/admin/tracks/${trackId}/credentials`)
            .then(response => response.json())
            .then(data => {
                showTrackCredentialsModal(trackId, data.credentials);
            })
            .catch(error => {
                console.error('Error loading track credentials:', error);
                alert('Error loading track credentials');
            });
    };

    window.deleteTrack = function(trackId) {
        if (confirm('Are you sure you want to delete this track?')) {
            alert('Delete functionality coming soon!');
        }
    };

    function loadPlaylists() {
        fetch('/admin/playlists')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load playlists');
                }
                return response.json();
            })
            .then(data => {
                displayPlaylists(data.playlists);
            })
            .catch(error => {
                console.error('Error loading playlists:', error);
                playlistsContainer.innerHTML = '<div class="empty-state">Error loading playlists</div>';
            });
    }

    function displayPlaylists(playlists) {
        if (playlists.length === 0) {
            playlistsContainer.innerHTML = '<div class="empty-state">No playlists created yet</div>';
            return;
        }

        const tableTemplate = document.getElementById('playlist-table-template');
        const table = tableTemplate.content.cloneNode(true).querySelector('table');
        const tbody = table.querySelector('tbody');

        playlists.forEach(playlist => {
            const rowTemplate = document.getElementById('playlist-row-template');
            const row = rowTemplate.content.cloneNode(true);

            row.querySelector('tr').id = `playlist-row-${playlist.id}`;
            row.querySelector('.playlist-title').textContent = playlist.title;
            row.querySelector('.playlist-uuid').textContent = playlist.uuid;
            row.querySelector('.playlist-uuid').href = `/playlist/${playlist.uuid}`;
            row.querySelector('.playlist-tracks').textContent = `${playlist.track_count} tracks`;
            row.querySelector('.playlist-protection').id = `playlist-protection-${playlist.id}`;
            row.querySelector('.playlist-created').textContent = new Date(playlist.created_at).toLocaleString();

            const editBtn = row.querySelector('.edit-btn');
            const deleteBtn = row.querySelector('.delete-btn');
            editBtn.onclick = () => editPlaylist(playlist.id);
            deleteBtn.onclick = () => deletePlaylist(playlist.id);

            tbody.appendChild(row);
        });

        playlistsContainer.innerHTML = '';
        playlistsContainer.appendChild(table);

        playlists.forEach(playlist => {
            loadPlaylistCredentialStatus(playlist.id);
        });
    }

    function createPlaylist() {
        const title = document.getElementById('playlistTitle').value.trim();

        if (!title) {
            alert('Please enter a playlist title');
            return;
        }

        const submitButton = playlistForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Creating...';

        fetch('/admin/playlists', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title: title })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to create playlist');
            }
            return response.json();
        })
        .then(data => {
            alert('Playlist created successfully!');
            playlistForm.reset();
            loadPlaylists();
        })
        .catch(error => {
            console.error('Error creating playlist:', error);
            alert('Error creating playlist. Please try again.');
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = 'Create Playlist';
        });
    }

    window.editPlaylist = function(playlistId) {
        Promise.all([
            fetch(`/admin/playlists/${playlistId}/tracks`),
            fetch('/admin/tracks'),
            fetch(`/admin/playlists/${playlistId}/credentials`)
        ])
        .then(responses => Promise.all(responses.map(r => r.json())))
        .then(([playlistTracksData, allTracksData, credentialsData]) => {
            showEditPlaylistModal(playlistId, playlistTracksData.tracks, allTracksData.tracks, credentialsData.credentials);
        })
        .catch(error => {
            console.error('Error loading playlist data:', error);
            alert('Error loading playlist data');
        });
    };

    window.deletePlaylist = function(playlistId) {
        if (confirm('Are you sure you want to delete this playlist?')) {
            fetch(`/admin/playlists/${playlistId}`, {
                method: 'DELETE'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to delete playlist');
                }
                return response.json();
            })
            .then(data => {
                alert('Playlist deleted successfully!');
                loadPlaylists();
            })
            .catch(error => {
                console.error('Error deleting playlist:', error);
                alert('Error deleting playlist. Please try again.');
            });
        }
    };

    function showTrackCredentialsModal(trackId, credentials) {
        const template = document.getElementById('track-credentials-modal-template');
        const modal = template.content.cloneNode(true);

        modal.querySelector('.modal-overlay').id = 'trackCredentialsModal';
        modal.querySelector('.credential-count').textContent = credentials.length;

        const credentialsList = modal.querySelector('.credentials-list');

        if (credentials.length === 0) {
            credentialsList.innerHTML = '<div class="empty-state" style="color: var(--color-text-muted); font-style: italic;">No credentials set - track is public</div>';
        } else {
            credentialsList.innerHTML = '';
            credentials.forEach(cred => {
                const itemTemplate = document.getElementById('credential-item-template');
                const item = itemTemplate.content.cloneNode(true);

                item.querySelector('.credential-username').textContent = cred.username;
                item.querySelector('.remove-btn').onclick = () => removeCredential(cred.id, trackId, 'track');

                credentialsList.appendChild(item);
            });
        }

        modal.querySelector('.modal-close').onclick = closeTrackCredentialsModal;
        modal.querySelector('.close-btn').onclick = closeTrackCredentialsModal;
        modal.querySelector('.add-btn').onclick = () => {
            const username = modal.querySelector('.username-input').value;
            const password = modal.querySelector('.password-input').value;
            addTrackCredential(trackId, username, password);
        };

        document.body.appendChild(modal);
    }

    function showEditPlaylistModal(playlistId, playlistTracks, allTracks, credentials) {
        const availableTracks = allTracks.filter(track =>
            !playlistTracks.find(pt => pt.id === track.id)
        );

        const template = document.getElementById('edit-playlist-modal-template');
        const modal = template.content.cloneNode(true);

        modal.querySelector('.modal-overlay').id = 'editPlaylistModal';

        // Populate tracks list
        modal.querySelector('.tracks-count').textContent = playlistTracks.length;
        const tracksList = modal.querySelector('.tracks-list');

        if (playlistTracks.length === 0) {
            tracksList.innerHTML = '<div class="empty-state" style="color: var(--color-text-muted); font-style: italic;">No tracks in playlist</div>';
        } else {
            tracksList.innerHTML = '';
            playlistTracks.forEach(track => {
                const itemTemplate = document.getElementById('playlist-track-item-template');
                const item = itemTemplate.content.cloneNode(true);

                item.querySelector('.track-title').textContent = track.title;
                item.querySelector('.remove-btn').onclick = () => removeTrackFromPlaylist(playlistId, track.id);

                tracksList.appendChild(item);
            });
        }

        // Populate available tracks select
        const trackSelect = modal.querySelector('.track-select');
        availableTracks.forEach(track => {
            const option = document.createElement('option');
            option.value = track.id;
            option.textContent = track.title;
            trackSelect.appendChild(option);
        });

        modal.querySelector('.add-track-btn').onclick = () => addTrackToPlaylist(playlistId, trackSelect);

        // Populate credentials list
        modal.querySelector('.credentials-count').textContent = credentials.length;
        const credentialsList = modal.querySelector('.credentials-list');

        if (credentials.length === 0) {
            credentialsList.innerHTML = '<div class="empty-state" style="color: var(--color-text-muted); font-style: italic;">No credentials set - playlist is public</div>';
        } else {
            credentialsList.innerHTML = '';
            credentials.forEach(cred => {
                const itemTemplate = document.getElementById('credential-item-template');
                const item = itemTemplate.content.cloneNode(true);

                item.querySelector('.credential-username').textContent = cred.username;
                item.querySelector('.remove-btn').onclick = () => removeCredential(cred.id, playlistId, 'playlist');

                credentialsList.appendChild(item);
            });
        }

        modal.querySelector('.modal-close').onclick = closeEditPlaylistModal;
        modal.querySelector('.close-btn').onclick = closeEditPlaylistModal;
        modal.querySelector('.add-credential-btn').onclick = () => {
            const username = modal.querySelector('.username-input').value;
            const password = modal.querySelector('.password-input').value;
            addPlaylistCredential(playlistId, username, password);
        };

        document.body.appendChild(modal);
    }

    window.closeEditPlaylistModal = function() {
        const modal = document.getElementById('editPlaylistModal');
        if (modal) {
            modal.remove();
        }
    };

    window.addTrackToPlaylist = function(playlistId, trackSelect) {
        const trackId = trackSelect.value;

        if (!trackId) {
            alert('Please select a track to add');
            return;
        }

        fetch(`/admin/playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ trackId: parseInt(trackId) })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to add track');
            }
            return response.json();
        })
        .then(data => {
            alert('Track added successfully!');
            closeEditPlaylistModal();
            loadPlaylists(); // Refresh the playlist table
        })
        .catch(error => {
            console.error('Error adding track:', error);
            alert('Error adding track to playlist');
        });
    };

    window.removeTrackFromPlaylist = function(playlistId, trackId) {
        if (!confirm('Remove this track from the playlist?')) {
            return;
        }

        fetch(`/admin/playlists/${playlistId}/tracks/${trackId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to remove track');
            }
            return response.json();
        })
        .then(data => {
            alert('Track removed successfully!');
            closeEditPlaylistModal();
            loadPlaylists(); // Refresh the playlist table
        })
        .catch(error => {
            console.error('Error removing track:', error);
            alert('Error removing track from playlist');
        });
    };

    function loadPlaylistCredentialStatus(playlistId) {
        fetch(`/admin/playlists/${playlistId}/credentials`)
            .then(response => response.json())
            .then(data => {
                const statusCell = document.getElementById(`playlist-protection-${playlistId}`);
                if (data.hasCredentials) {
                    statusCell.innerHTML = `<span class="credentials-status credentials-protected">Private</span>`;
                } else {
                    statusCell.innerHTML = `<span class="credentials-status credentials-unprotected">Public</span>`;
                }
            })
            .catch(error => {
                console.error('Error loading credential status:', error);
                const statusCell = document.getElementById(`playlist-protection-${playlistId}`);
                statusCell.innerHTML = '<span class="credentials-status credentials-unprotected">Error</span>';
            });
    }


    window.closeTrackCredentialsModal = function() {
        const modal = document.getElementById('trackCredentialsModal');
        if (modal) {
            modal.remove();
        }
    };

    window.addTrackCredential = function(trackId, username, password) {
        if (!username || !password) {
            alert('Please enter both username and password');
            return;
        }

        fetch(`/admin/tracks/${trackId}/credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: username.trim(), password })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to add credential');
            }
            return response.json();
        })
        .then(data => {
            alert('Credential added successfully!');
            closeTrackCredentialsModal();
            loadTrackCredentialStatus(trackId);
        })
        .catch(error => {
            console.error('Error adding credential:', error);
            alert('Error adding credential. Please try again.');
        });
    };

    window.addPlaylistCredential = function(playlistId, username, password) {
        if (!username || !password) {
            alert('Please enter both username and password');
            return;
        }

        fetch(`/admin/playlists/${playlistId}/credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: username.trim(), password })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to add credential');
            }
            return response.json();
        })
        .then(data => {
            alert('Credential added successfully!');
            closeEditPlaylistModal();
            loadPlaylistCredentialStatus(playlistId);
        })
        .catch(error => {
            console.error('Error adding credential:', error);
            alert('Error adding credential. Please try again.');
        });
    };

    window.removeCredential = function(credentialId, resourceId, resourceType) {
        if (!confirm('Are you sure you want to remove this credential?')) {
            return;
        }

        fetch(`/admin/credentials/${credentialId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to remove credential');
            }
            return response.json();
        })
        .then(data => {
            alert('Credential removed successfully!');
            if (resourceType === 'track') {
                closeTrackCredentialsModal();
                loadTrackCredentialStatus(resourceId);
            } else {
                closeEditPlaylistModal();
                loadPlaylistCredentialStatus(resourceId);
            }
        })
        .catch(error => {
            console.error('Error removing credential:', error);
            alert('Error removing credential. Please try again.');
        });
    };
});
