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

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Title</th>
                    <th>UUID</th>
                    <th>Filename</th>
                    <th>Protection</th>
                    <th>Created</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${tracks.map(track => `
                    <tr id="track-row-${track.id}">
                        <td>${escapeHtml(track.title)}</td>
                        <td>
                            <a href="/track/${track.uuid}" class="uuid-link" target="_blank">
                                ${track.uuid}
                            </a>
                        </td>
                        <td>${escapeHtml(track.filename)}</td>
                        <td id="track-protection-${track.id}">
                            <span class="credentials-status credentials-unprotected">Loading...</span>
                        </td>
                        <td>${new Date(track.created_at).toLocaleString()}</td>
                        <td class="actions">
                            <button onclick="editTrack(${track.id})">Edit</button>
                            <button onclick="deleteTrack(${track.id})" class="btn-danger">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;

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

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function loadTrackCredentialStatus(trackId) {
        fetch(`/admin/tracks/${trackId}/credentials`)
            .then(response => response.json())
            .then(data => {
                const statusCell = document.getElementById(`track-protection-${trackId}`);
                if (data.hasCredentials) {
                    statusCell.innerHTML = `
                        <span class="credentials-status credentials-protected">Protected (${escapeHtml(data.username)})</span>
                        <button onclick="removeTrackCredentials(${trackId})" class="btn-danger" style="padding: 2px 6px; font-size: 11px; margin-left: 5px;">Remove</button>
                    `;
                } else {
                    statusCell.innerHTML = `
                        <span class="credentials-status credentials-unprotected">Public</span>
                        <button onclick="showTrackCredentialsForm(${trackId})" style="padding: 2px 6px; font-size: 11px; margin-left: 5px;">Protect</button>
                    `;
                }
            })
            .catch(error => {
                console.error('Error loading credential status:', error);
                const statusCell = document.getElementById(`track-protection-${trackId}`);
                statusCell.innerHTML = '<span class="credentials-status credentials-unprotected">Error</span>';
            });
    }

    window.showTrackCredentialsForm = function(trackId) {
        const statusCell = document.getElementById(`track-protection-${trackId}`);
        statusCell.innerHTML = `
            <div class="credentials-form">
                <input type="text" id="track-username-${trackId}" placeholder="Username" required>
                <input type="password" id="track-password-${trackId}" placeholder="Password" required>
                <button onclick="setTrackCredentials(${trackId})">Set</button>
                <button onclick="loadTrackCredentialStatus(${trackId})" class="btn-secondary">Cancel</button>
            </div>
        `;
    };

    window.setTrackCredentials = function(trackId) {
        const username = document.getElementById(`track-username-${trackId}`).value.trim();
        const password = document.getElementById(`track-password-${trackId}`).value;

        if (!username || !password) {
            alert('Please enter both username and password');
            return;
        }

        fetch(`/admin/tracks/${trackId}/credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to set credentials');
            }
            return response.json();
        })
        .then(data => {
            alert('Track protection set successfully!');
            loadTrackCredentialStatus(trackId);
        })
        .catch(error => {
            console.error('Error setting credentials:', error);
            alert('Error setting credentials. Please try again.');
        });
    };

    window.removeTrackCredentials = function(trackId) {
        if (!confirm('Are you sure you want to remove protection from this track?')) {
            return;
        }

        fetch(`/admin/tracks/${trackId}/credentials`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to remove credentials');
            }
            return response.json();
        })
        .then(data => {
            alert('Track protection removed successfully!');
            loadTrackCredentialStatus(trackId);
        })
        .catch(error => {
            console.error('Error removing credentials:', error);
            alert('Error removing credentials. Please try again.');
        });
    };

    window.editTrack = function(trackId) {
        alert('Edit track title functionality coming soon!');
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

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Title</th>
                    <th>UUID</th>
                    <th>Tracks</th>
                    <th>Protection</th>
                    <th>Created</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${playlists.map(playlist => `
                    <tr id="playlist-row-${playlist.id}">
                        <td>${escapeHtml(playlist.title)}</td>
                        <td>
                            <a href="/playlist/${playlist.uuid}" class="uuid-link" target="_blank">
                                ${playlist.uuid}
                            </a>
                        </td>
                        <td>${playlist.track_count} tracks</td>
                        <td id="playlist-protection-${playlist.id}">
                            <span class="credentials-status credentials-unprotected">Loading...</span>
                        </td>
                        <td>${new Date(playlist.created_at).toLocaleString()}</td>
                        <td class="actions">
                            <button onclick="editPlaylist(${playlist.id})">Edit</button>
                            <button onclick="deletePlaylist(${playlist.id})" class="btn-danger">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;

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
        // Load playlist and tracks data first
        Promise.all([
            fetch(`/admin/playlists/${playlistId}/tracks`),
            fetch('/admin/tracks')
        ])
        .then(responses => Promise.all(responses.map(r => r.json())))
        .then(([playlistTracksData, allTracksData]) => {
            showEditPlaylistModal(playlistId, playlistTracksData.tracks, allTracksData.tracks);
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

    function showEditPlaylistModal(playlistId, playlistTracks, allTracks) {
        const availableTracks = allTracks.filter(track =>
            !playlistTracks.find(pt => pt.id === track.id)
        );

        const modalHTML = `
            <div class="modal-overlay" id="editPlaylistModal">
                <div class="modal" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3 class="modal-title">Edit Playlist</h3>
                        <button class="modal-close" onclick="closeEditPlaylistModal()">×</button>
                    </div>

                    <div class="form-group">
                        <h4>Current Tracks (${playlistTracks.length})</h4>
                        <div id="currentTracks" style="max-height: 200px; overflow-y: auto; border: 1px solid #333; background: #000; padding: 10px;">
                            ${playlistTracks.length === 0 ?
                                '<div style="color: #666; font-style: italic;">No tracks in playlist</div>' :
                                playlistTracks.map(track => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #222;">
                                        <span>${escapeHtml(track.title)}</span>
                                        <button onclick="removeTrackFromPlaylist(${playlistId}, ${track.id})" class="btn-danger" style="padding: 4px 8px; font-size: 12px;">Remove</button>
                                    </div>
                                `).join('')
                            }
                        </div>
                    </div>

                    <div class="form-group">
                        <h4>Add Track</h4>
                        <select id="trackToAdd" style="width: 100%; padding: 10px; background: #111; border: 1px solid #333; color: #fff;">
                            <option value="">Select a track to add...</option>
                            ${availableTracks.map(track => `
                                <option value="${track.id}">${escapeHtml(track.title)}</option>
                            `).join('')}
                        </select>
                        <button onclick="addTrackToPlaylist(${playlistId})" style="margin-top: 10px;">Add Track</button>
                    </div>

                    <div class="modal-actions">
                        <button onclick="closeEditPlaylistModal()" class="btn-secondary">Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    window.closeEditPlaylistModal = function() {
        const modal = document.getElementById('editPlaylistModal');
        if (modal) {
            modal.remove();
        }
    };

    window.addTrackToPlaylist = function(playlistId) {
        const trackSelect = document.getElementById('trackToAdd');
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
                    statusCell.innerHTML = `
                        <span class="credentials-status credentials-protected">Protected (${escapeHtml(data.username)})</span>
                        <button onclick="removePlaylistCredentials(${playlistId})" class="btn-danger" style="padding: 2px 6px; font-size: 11px; margin-left: 5px;">Remove</button>
                    `;
                } else {
                    statusCell.innerHTML = `
                        <span class="credentials-status credentials-unprotected">Public</span>
                        <button onclick="showPlaylistCredentialsForm(${playlistId})" style="padding: 2px 6px; font-size: 11px; margin-left: 5px;">Protect</button>
                    `;
                }
            })
            .catch(error => {
                console.error('Error loading credential status:', error);
                const statusCell = document.getElementById(`playlist-protection-${playlistId}`);
                statusCell.innerHTML = '<span class="credentials-status credentials-unprotected">Error</span>';
            });
    }

    window.showPlaylistCredentialsForm = function(playlistId) {
        const statusCell = document.getElementById(`playlist-protection-${playlistId}`);
        statusCell.innerHTML = `
            <div class="credentials-form">
                <input type="text" id="playlist-username-${playlistId}" placeholder="Username" required>
                <input type="password" id="playlist-password-${playlistId}" placeholder="Password" required>
                <button onclick="setPlaylistCredentials(${playlistId})">Set</button>
                <button onclick="loadPlaylistCredentialStatus(${playlistId})" class="btn-secondary">Cancel</button>
            </div>
        `;
    };

    window.setPlaylistCredentials = function(playlistId) {
        const username = document.getElementById(`playlist-username-${playlistId}`).value.trim();
        const password = document.getElementById(`playlist-password-${playlistId}`).value;

        if (!username || !password) {
            alert('Please enter both username and password');
            return;
        }

        fetch(`/admin/playlists/${playlistId}/credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to set credentials');
            }
            return response.json();
        })
        .then(data => {
            alert('Playlist protection set successfully!');
            loadPlaylistCredentialStatus(playlistId);
        })
        .catch(error => {
            console.error('Error setting credentials:', error);
            alert('Error setting credentials. Please try again.');
        });
    };

    window.removePlaylistCredentials = function(playlistId) {
        if (!confirm('Are you sure you want to remove protection from this playlist?')) {
            return;
        }

        fetch(`/admin/playlists/${playlistId}/credentials`, {
            method: 'DELETE'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to remove credentials');
            }
            return response.json();
        })
        .then(data => {
            alert('Playlist protection removed successfully!');
            loadPlaylistCredentialStatus(playlistId);
        })
        .catch(error => {
            console.error('Error removing credentials:', error);
            alert('Error removing credentials. Please try again.');
        });
    };
});
