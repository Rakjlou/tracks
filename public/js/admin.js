document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('uploadForm');
    const tracksContainer = document.getElementById('tracksContainer');

    loadTracks();

    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        uploadTrack();
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
                    <th>Created</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${tracks.map(track => `
                    <tr>
                        <td>${escapeHtml(track.title)}</td>
                        <td>
                            <a href="/track/${track.uuid}" class="uuid-link" target="_blank">
                                ${track.uuid}
                            </a>
                        </td>
                        <td>${escapeHtml(track.filename)}</td>
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

    window.editTrack = function(trackId) {
        alert('Edit functionality coming soon!');
    };

    window.deleteTrack = function(trackId) {
        if (confirm('Are you sure you want to delete this track?')) {
            alert('Delete functionality coming soon!');
        }
    };
});