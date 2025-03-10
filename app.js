// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getDatabase, ref, push, get, update, remove } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, EmailAuthProvider, updateProfile } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD0HXvqtZrIhSNojvXZ2MaR_tcr_YZScSU",
    authDomain: "nectar-verses-f7f18.firebaseapp.com",
    projectId: "nectar-verses-f7f18",
    storageBucket: "nectar-verses-f7f18.firebasestorage.app",
    messagingSenderId: "783141260318",
    appId: "1:783141260318:web:e5541a79da031416b3f20f",
    databaseURL: "https://nectar-verses-f7f18-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Add auth initialization after Firebase initialization
const auth = getAuth(app);

// Toast notification function
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remove toast after animation
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 2000);
}

// Enhanced audio recording function with better quality settings and feedback
async function recordAudio() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100,
                channelCount: 1
            } 
        });
        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000
        });
        const audioChunks = [];
        let recordingTimer;
        let recordingTime = 0;

        return new Promise((resolve, reject) => {
            mediaRecorder.addEventListener("dataavailable", event => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            });

            mediaRecorder.addEventListener("start", () => {
                // Update UI to show recording state
                const recordBtn = document.querySelector('.record-btn');
                const stopBtn = document.querySelector('.stop-btn');
                if (recordBtn && stopBtn) {
                    recordBtn.style.display = 'none';
                    stopBtn.style.display = 'flex';
                    stopBtn.style.width = '100%';
                    stopBtn.style.justifyContent = 'center';
                    stopBtn.style.alignItems = 'center';
                    stopBtn.style.gap = '8px';
                    stopBtn.style.background = 'var(--maroon)';
                    stopBtn.style.color = 'white';
                    stopBtn.style.padding = '12px';
                    stopBtn.style.borderRadius = '25px';
                    stopBtn.style.cursor = 'pointer';
                    stopBtn.style.transition = 'all 0.2s ease';
                }

                recordingTimer = setInterval(() => {
                    recordingTime++;
                    const recordingStatus = document.querySelector('.recording-status');
                    if (recordingStatus) {
                        recordingStatus.textContent = `Recording... ${30 - recordingTime} seconds remaining`;
                        recordingStatus.style.color = '#800000';
                    }
                    if (recordingTime >= 30) {
                        mediaRecorder.stop();
                    }
                }, 1000);
            });

            mediaRecorder.addEventListener("stop", async () => {
                clearInterval(recordingTimer);
                try {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
                    stream.getTracks().forEach(track => track.stop());
                    
                    if (audioBlob.size > 5000000) {
                        throw new Error("Recording too large. Please keep it under 30 seconds.");
                    }

                    // Update UI to show completed state
                    const recordBtn = document.querySelector('.record-btn');
                    const stopBtn = document.querySelector('.stop-btn');
                    if (recordBtn && stopBtn) {
                        recordBtn.style.display = 'flex';
                        stopBtn.style.display = 'none';
                    }

                    const recordingStatus = document.querySelector('.recording-status');
                    if (recordingStatus) {
                        recordingStatus.textContent = 'Recording saved! Click to record again.';
                        recordingStatus.style.color = '#006994';
                    }

                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = () => {
                        resolve(reader.result);
                    };
                } catch (error) {
                    reject(error);
                }
            });

            // Create a function to stop recording that can be called externally
            window.stopRecording = () => {
                if (mediaRecorder.state === "recording") {
                    mediaRecorder.stop();
                }
            };

            mediaRecorder.start(1000);
        });
    } catch (error) {
        console.error("Error accessing microphone:", error);
        showToast("Error accessing microphone: " + error.message);
        throw error;
    }
}

// Function to get verses from Realtime Database
async function getVerses() {
    if (!auth.currentUser) return [];
    try {
        const versesRef = ref(db, `users/${auth.currentUser.uid}/verses`);
        const snapshot = await get(versesRef);
        if (snapshot.exists()) {
            const verses = [];
            snapshot.forEach((child) => {
                verses.push({
                    id: child.key,
                    ...child.val()
                });
            });
            return verses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        return [];
    } catch (error) {
        console.error("Error getting verses:", error);
        return [];
    }
}

// Enhanced verse saving function with better validation and error handling
async function addVerse(verseData) {
    if (!auth.currentUser) throw new Error("User is not logged in");
    try {
        // Validate required fields
        const requiredFields = ['verse', 'chand', 'book', 'subject'];
        for (const field of requiredFields) {
            if (!verseData[field]?.trim()) {
                throw new Error(`${field.charAt(0).toUpperCase() + field.slice(1)} is required`);
            }
        }

        // Validate and clean tags
        if (typeof verseData.tags === 'string') {
            verseData.tags = verseData.tags
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);
        } else if (!Array.isArray(verseData.tags)) {
            verseData.tags = [];
        }

        const versesRef = ref(db, `users/${auth.currentUser.uid}/verses`);
        const newVerseRef = push(versesRef);
        
        // Add metadata
        const finalVerseData = {
            ...verseData,
            userId: auth.currentUser.uid,
            userEmail: auth.currentUser.email,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            likes: 0,
            shares: 0
        };

        await update(newVerseRef, finalVerseData);
        console.log("Verse added with ID: ", newVerseRef.key);
        showToast('Verse added successfully!');
        return newVerseRef.key;
    } catch (error) {
        console.error("Error adding verse: ", error);
        showToast('Error: ' + error.message);
        throw error;
    }
}

// Enhanced verse rendering with better animation and loading states
async function renderVerses() {
    const versesGrid = document.querySelector('.verses-grid');
    try {
        const verses = await getVerses();
        
        versesGrid.innerHTML = verses.map(verse => `
            <div class="verse-item">
                <div class="verse-source">${verse.book || 'Unknown Book'}${verse.reference ? ` - ${verse.reference}` : ''}</div>
                <div class="verse-text">${verse.verse || ''}</div>
                
                ${verse.meaning ? `
                    <div class="meaning-section">
                        <button class="meaning-toggle" onclick="this.nextElementSibling.classList.toggle('expanded'); this.querySelector('.material-icons').style.transform = this.nextElementSibling.classList.contains('expanded') ? 'rotate(180deg)' : 'rotate(0deg)'">
                            <span>View Meaning & Explanation</span>
                            <span class="material-icons">expand_more</span>
                        </button>
                        <div class="meaning-content">
                            ${verse.meaning}
                        </div>
                    </div>
                ` : ''}

                <div class="verse-meta">
                    <div class="meta-item">
                        <span class="material-icons">music_note</span>
                        ${verse.chand || 'Unknown Chand'}
                    </div>
                    <div class="meta-item">
                        <span class="material-icons">auto_stories</span>
                        ${verse.book || 'Unknown Book'}
                    </div>
                    <div class="meta-item">
                        <span class="material-icons">category</span>
                        ${verse.subject || 'General'}
                    </div>
                </div>

                <div class="verse-tags">
                    ${(verse.tags || []).map(tag => `
                        <span class="tag">${tag}</span>
                    `).join('')}
                </div>

                <div class="verse-actions">
                    ${verse.audioData ? `
                        <div class="audio-player" id="player-${verse.id}"></div>
                    ` : ''}
                    <button class="action-btn copy-btn" data-verse="${verse.verse}" data-meaning="${verse.meaning || ''}" title="Copy verse">
                        <span class="material-icons">content_copy</span>
                    </button>
                    <button class="action-btn edit-btn" data-id="${verse.id}" title="Edit verse">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="action-btn delete-btn" data-id="${verse.id}" title="Delete verse">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
            </div>
        `).join('');

        // Add copy functionality
        document.querySelectorAll('.copy-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const verse = button.dataset.verse;
                const meaning = button.dataset.meaning;
                const textToCopy = meaning ? `${verse}\n\nMeaning & Explanation:\n${meaning}` : verse;
                try {
                    await navigator.clipboard.writeText(textToCopy);
                    showToast('Verse copied to clipboard!');
                } catch (err) {
                    console.error('Failed to copy text: ', err);
                    showToast('Failed to copy verse');
                }
            });
        });

        // Add event listeners for edit and delete buttons
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const verseId = button.dataset.id;
                editVerse(verseId);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const verseId = button.dataset.id;
                confirmDelete(verseId);
            });
        });

        // Initialize audio players for verses with audio
        verses.forEach(verse => {
            if (verse.audioData) {
                const container = document.getElementById(`player-${verse.id}`);
                if (container) {
                    new AudioPlayer(verse.audioData, container);
                }
            }
        });

        // Add event listeners for meaning toggle
        // Removed as now handled inline in the template
    } catch (error) {
        console.error("Error rendering verses:", error);
        versesGrid.innerHTML = '<div class="error">Error loading verses. Please try again later.</div>';
    }
}

// Update renderRecentVerses to show simplified cards with creation date
async function renderRecentVerses() {
    const versesScroll = document.querySelector('.verses-scroll');
    const verses = await getVerses();
    const recentVerses = verses.slice(0, 5);

    versesScroll.innerHTML = recentVerses.map(verse => `
        <div class="verse-card animate-in">
            <div class="verse-source">${verse.book || 'Unknown Book'}${verse.reference ? ` - ${verse.reference}` : ''}</div>
            <div class="verse-text">${verse.verse || ''}</div>
            
            ${verse.meaning ? `
                <div class="meaning-section">
                    <button class="meaning-toggle" onclick="this.nextElementSibling.classList.toggle('expanded'); this.querySelector('.material-icons').style.transform = this.nextElementSibling.classList.contains('expanded') ? 'rotate(180deg)' : 'rotate(0deg)'">
                        <span>View Meaning & Explanation</span>
                        <span class="material-icons">expand_more</span>
                    </button>
                    <div class="meaning-content">
                        ${verse.meaning}
                    </div>
                </div>
            ` : ''}

            ${verse.tags ? `
            <div class="verse-tags">
                ${verse.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            ` : ''}
            
            <div class="verse-date">
                Added on ${new Date(verse.createdAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                })}
            </div>
        </div>
    `).join('');
}

// Function to update verse in Realtime Database
async function updateVerse(verseId, verseData) {
    if (!auth.currentUser) throw new Error("User is not logged in");
    try {
        const verseRef = ref(db, `users/${auth.currentUser.uid}/verses/${verseId}`);
        const updatedData = {
            ...verseData,
            updatedAt: new Date().toISOString(),
            userId: auth.currentUser.uid,
            userEmail: auth.currentUser.email
        };
        await update(verseRef, updatedData);
        showToast('Verse updated successfully!');
    } catch (error) {
        console.error("Error updating verse: ", error);
        showToast('Error updating verse');
    }
}

// Function to delete verse from Realtime Database
async function deleteVerse(verseId) {
    if (!auth.currentUser) throw new Error("User is not logged in");
    try {
        const verseRef = ref(db, `users/${auth.currentUser.uid}/verses/${verseId}`);
        await remove(verseRef);
        showToast('Verse deleted successfully!');
    } catch (error) {
        console.error("Error deleting verse:", error);
        showToast('Error deleting verse');
    }
}

class AudioPlayer {
    constructor(audioData, container) {
        this.audio = new Audio(audioData);
        this.container = container;
        this.isPlaying = false;
        this.isLooping = false;
        this.speed = 1;
        this.audioData = audioData;
        this.createPlayer();
        this.setupEventListeners();
        
        // Initialize speed display
        this.speedButton = this.container.querySelector('.speed-button');
        this.speedOptions = this.container.querySelector('.speed-options');
        this.updateSpeedDisplay();
        
        // Preload audio
        this.preloadAudio().catch(error => {
            console.error('Error preloading audio:', error);
        });
    }

    createPlayer() {
        this.container.innerHTML = `
            <div class="audio-main-controls">
                <button class="temple-bell-button">
                    <span class="material-icons">
                        ${this.isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                </button>
                <div class="playback-controls">
                    <button class="loop-button" title="Repeat">
                        <span class="material-icons">repeat</span>
                    </button>
                    <div class="speed-control">
                        <button class="speed-button">
                            ${this.speed}x
                        </button>
                        <div class="speed-options">
                            <button data-speed="0.5">0.5x</button>
                            <button data-speed="1" class="active">1x</button>
                            <button data-speed="1.5">1.5x</button>
                            <button data-speed="2">2x</button>
                        </div>
                    </div>
                    <button class="download-button" title="Download Audio">
                        <span class="material-icons">download</span>
                    </button>
                </div>
            </div>
            <div class="audio-progress-container">
                <span class="current-time">0:00</span>
                <div class="audio-progress">
                    <div class="progress-bar"></div>
                    <div class="progress-handle"></div>
                </div>
                <span class="total-duration">0:00</span>
            </div>
        `;

        this.playButton = this.container.querySelector('.temple-bell-button');
        this.progressBar = this.container.querySelector('.progress-bar');
        this.progressHandle = this.container.querySelector('.progress-handle');
        this.currentTimeDisplay = this.container.querySelector('.current-time');
        this.totalDurationDisplay = this.container.querySelector('.total-duration');
        this.loopButton = this.container.querySelector('.loop-button');
        this.speedButton = this.container.querySelector('.speed-button');
        this.speedOptions = this.container.querySelector('.speed-options');
        this.downloadButton = this.container.querySelector('.download-button');
        
        // Initialize displays with placeholder values
        this.currentTimeDisplay.textContent = '0:00';
        this.totalDurationDisplay.textContent = '0:00';
    }

    setupEventListeners() {
        // Play/Pause
        this.playButton.addEventListener('click', () => this.togglePlay());
        
        // Loop control
        this.loopButton.addEventListener('click', () => {
            this.isLooping = !this.isLooping;
            this.audio.loop = this.isLooping;
            this.loopButton.classList.toggle('active');
        });

        // Speed control
        document.addEventListener('click', (e) => {
            const speedControl = this.container.querySelector('.speed-control');
            if (!speedControl?.contains(e.target)) {
                this.speedOptions?.classList.remove('show');
            }
        });

        this.speedButton?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.speedOptions?.classList.toggle('show');
        });

        this.speedOptions?.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const speed = parseFloat(button.dataset.speed);
                this.speed = speed;
                this.audio.playbackRate = speed;
                this.updateSpeedDisplay();
                
                // Update active state
                this.speedOptions.querySelectorAll('button').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
                
                this.speedOptions.classList.remove('show');
            });
        });

        // Time update
        this.audio.addEventListener('timeupdate', () => {
            if (!isNaN(this.audio.duration) && isFinite(this.audio.duration)) {
                const progress = (this.audio.currentTime / this.audio.duration) * 100;
                requestAnimationFrame(() => {
                    this.progressBar.style.width = `${progress}%`;
                    this.progressHandle.style.left = `${progress}%`;
                    this.currentTimeDisplay.textContent = this.formatTime(this.audio.currentTime);
                });
            }
        });

        // Duration loaded
        this.audio.addEventListener('loadedmetadata', () => {
            if (!isNaN(this.audio.duration) && isFinite(this.audio.duration)) {
                this.totalDurationDisplay.textContent = this.formatTime(this.audio.duration);
            }
        });

        // Add a canplay event to ensure audio is ready
        this.audio.addEventListener('canplay', () => {
            if (!isNaN(this.audio.duration) && isFinite(this.audio.duration)) {
                this.totalDurationDisplay.textContent = this.formatTime(this.audio.duration);
            }
        });

        // Add error handler for the audio element
        this.audio.addEventListener('error', () => {
            console.error('Error loading audio:', this.audio.error);
            this.currentTimeDisplay.textContent = '0:00';
            this.totalDurationDisplay.textContent = '0:00';
        });

        // Seekbar interaction
        const progressContainer = this.container.querySelector('.audio-progress');
        
        const updateProgress = (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            this.audio.currentTime = pos * this.audio.duration;
        };

        progressContainer.addEventListener('click', updateProgress);
        
        // Handle drag functionality
        let isDragging = false;
        
        this.progressHandle.addEventListener('mousedown', () => {
            isDragging = true;
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                updateProgress(e);
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // End of playback
        this.audio.addEventListener('ended', () => {
            if (!this.isLooping) {
                this.isPlaying = false;
                this.playButton.classList.remove('playing');
            }
        });

        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault();
                this.togglePlay();
            }
        });

        // Download button click handler
        this.downloadButton?.addEventListener('click', () => this.downloadAudio());
    }

    async preloadAudio() {
        return new Promise((resolve, reject) => {
            const loadHandler = () => {
                if (!isNaN(this.audio.duration) && isFinite(this.audio.duration)) {
                    this.totalDurationDisplay.textContent = this.formatTime(this.audio.duration);
                    this.audio.removeEventListener('loadedmetadata', loadHandler);
                    resolve();
                }
            };
            
            this.audio.addEventListener('loadedmetadata', loadHandler);
            
            // Add error handling
            this.audio.addEventListener('error', (e) => {
                console.error('Error loading audio:', e);
                reject(e);
            });

            // Force load if needed
            if (this.audio.readyState >= 2) {
                loadHandler();
            }
        });
    }

    async togglePlay() {
        try {
            if (!this.audio.duration || isNaN(this.audio.duration)) {
                await this.preloadAudio();
            }
            
            if (this.isPlaying) {
                this.audio.pause();
                this.playButton.querySelector('.material-icons').textContent = 'play_arrow';
            } else {
                await this.audio.play();
                this.playButton.querySelector('.material-icons').textContent = 'pause';
            }
            
            this.isPlaying = !this.isPlaying;
            this.playButton.classList.toggle('playing');
        } catch (error) {
            console.error('Error toggling play state:', error);
            showToast('Error playing audio');
        }
    }

    setPlaybackSpeed(speed) {
        this.speed = speed;
        this.audio.playbackRate = speed;
        this.updateSpeedDisplay();
    }

    formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) {
            return '0:00';
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    updateSpeedDisplay() {
        if (this.speedButton) {
            this.speedButton.textContent = `${this.speed}x`;
        }
    }

    async downloadAudio() {
        try {
            // Get the verse card or item containing this audio player
            const verseCard = this.container.closest('.verse-card') || this.container.closest('.verse-item');
            
            // Get the verse source (which contains Book Name - Reference)
            let fileName = 'verse-recitation.mp3';
            if (verseCard) {
                const verseSource = verseCard.querySelector('.verse-source');
                if (verseSource) {
                    fileName = `${verseSource.textContent.trim()}.mp3`
                        .replace(/[^a-z0-9]/gi, '_') // Replace invalid characters with underscore
                        .toLowerCase();
                }
            }
            
            // Convert base64 to blob
            const response = await fetch(this.audioData);
            const blob = await response.blob();
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showToast('Download started');
        } catch (error) {
            console.error('Error downloading audio:', error);
            showToast('Error downloading audio');
        }
    }

    destroy() {
        this.audio.pause();
        this.audio = null;
        this.container.innerHTML = '';
    }
}

// Function to handle edit verse
async function editVerse(verseId) {
    try {
        const verses = await getVerses();
        const verse = verses.find(v => v.id === verseId);
        if (!verse) return;

        const dialog = document.createElement('div');
        dialog.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content animate-in">
                    <h2>Edit Verse</h2>
                    <form id="verse-form">
                        <textarea name="verse" placeholder="Enter verse text (Sanskrit/Hindi)" required>${verse.verse || ''}</textarea>
                        
                        <div class="input-with-suggestions">
                            <input type="text" name="chand" placeholder="Chand (Meter)" required value="${verse.chand || ''}">
                            <div class="suggestions-dropdown">
                                <div class="suggestion-item" data-value="">
                                    <span class="material-icons">music_note</span>
                                    Loading...
                                </div>
                            </div>
                        </div>

                        <div class="input-with-suggestions">
                            <input type="text" name="book" placeholder="Book Name" required value="${verse.book || ''}">
                            <div class="suggestions-dropdown">
                                <div class="suggestion-item" data-value="">
                                    <span class="material-icons">auto_stories</span>
                                    Loading...
                                </div>
                            </div>
                        </div>

                        <div class="input-with-suggestions">
                            <input type="text" name="reference" placeholder="Reference (e.g., Chapter/Verse)" required value="${verse.reference || ''}">
                            <div class="suggestions-dropdown">
                                <div class="suggestion-item" data-value="">
                                    <span class="material-icons">bookmark</span>
                                    Loading...
                                </div>
                            </div>
                        </div>

                        <div class="input-with-suggestions">
                            <input type="text" name="subject" placeholder="Subject" required value="${verse.subject || ''}">
                            <div class="suggestions-dropdown">
                                <div class="suggestion-item" data-value="">
                                    <span class="material-icons">category</span>
                                    Loading...
                                </div>
                            </div>
                        </div>

                        <div class="tags-input-container">
                            <input type="text" name="tags" placeholder="Tags (comma separated)" required value="${Array.isArray(verse.tags) ? verse.tags.join(', ') : ''}">
                            <div class="tags-suggestions">
                                Loading tags...
                            </div>
                        </div>

                        <div class="audio-recording-section">
                            <div class="recording-controls">
                                <button type="button" class="record-btn" data-state="idle">
                                    <span class="material-icons">mic</span>
                                    <span class="btn-text">Record Recitation</span>
                                </button>
                                <button type="button" class="stop-btn" style="display: none;">
                                    <span class="material-icons">stop</span>
                                    <span class="btn-text">Stop Recording</span>
                                </button>
                            </div>
                            <div class="recording-status"></div>
                            ${verse.audioData ? '<div class="current-audio-status">Current audio recording exists</div>' : ''}
                        </div>
                        <textarea name="meaning" placeholder="Meaning & Explanation" required>${verse.meaning || ''}</textarea>
                        <div class="button-group">
                            <button type="button" class="cancel-btn">Cancel</button>
                            <button type="submit" class="submit-btn">Update Verse</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        getUniqueValues().then(uniqueValues => {
            // Update Chand suggestions
            dialog.querySelector('input[name="chand"]').closest('.input-with-suggestions').querySelector('.suggestions-dropdown').innerHTML = 
                uniqueValues.chands.map(chand => `
                    <div class="suggestion-item" data-value="${chand}">
                        <span class="material-icons">music_note</span>
                        ${chand}
                    </div>
                `).join('');

            // Update Book suggestions
            dialog.querySelector('input[name="book"]').closest('.input-with-suggestions').querySelector('.suggestions-dropdown').innerHTML = 
                uniqueValues.books.map(book => `
                    <div class="suggestion-item" data-value="${book}">
                        <span class="material-icons">auto_stories</span>
                        ${book}
                    </div>
                `).join('');

            // Update Reference suggestions
            dialog.querySelector('input[name="reference"]').closest('.input-with-suggestions').querySelector('.suggestions-dropdown').innerHTML = 
                uniqueValues.references.map(ref => `
                    <div class="suggestion-item" data-value="${ref}">
                        <span class="material-icons">bookmark</span>
                        ${ref}
                    </div>
                `).join('');

            // Update Subject suggestions
            dialog.querySelector('input[name="subject"]').closest('.input-with-suggestions').querySelector('.suggestions-dropdown').innerHTML = 
                uniqueValues.subjects.map(subject => `
                    <div class="suggestion-item" data-value="${subject}">
                        <span class="material-icons">category</span>
                        ${subject}
                    </div>
                `).join('');

            // Update Tags suggestions
            dialog.querySelector('.tags-suggestions').innerHTML = 
                uniqueValues.tags.map(tag => `
                    <span class="tag-suggestion" data-tag="${tag}">${tag}</span>
                `).join('');

            // Setup suggestion handlers after updating content
            setupSuggestionHandlers(dialog);

            // Add tag suggestion click handler
            const tagsInput = dialog.querySelector('input[name="tags"]');
            dialog.querySelectorAll('.tag-suggestion').forEach(tag => {
                tag.addEventListener('click', () => {
                    const tagValue = tag.dataset.tag;
                    const currentTags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);
                    if (!currentTags.includes(tagValue)) {
                        currentTags.push(tagValue);
                        tagsInput.value = currentTags.join(', ');
                    }
                });
            });
        });

        let isRecording = false;
        let recordedAudioBase64 = null;

        // Handle recording
        const recordBtn = dialog.querySelector('.record-btn');
        const stopBtn = dialog.querySelector('.stop-btn');
        const recordingStatus = dialog.querySelector('.recording-status');
        
        recordBtn.addEventListener('click', async () => {
            try {
                if (!isRecording) {
                    // Start recording
                    recordBtn.style.display = 'none';
                    stopBtn.style.display = 'flex';
                    isRecording = true;

                    try {
                        recordedAudioBase64 = await recordAudio();
                        // Reset buttons after recording
                        recordBtn.style.display = 'flex';
                        stopBtn.style.display = 'none';
                        isRecording = false;
                    } catch (error) {
                        showToast(error.message);
                        // Reset recording state
                        recordBtn.style.display = 'flex';
                        stopBtn.style.display = 'none';
                        isRecording = false;
                    }
                }
            } catch (error) {
                console.error("Error in recording:", error);
                showToast("Recording failed: " + error.message);
                isRecording = false;
            }
        });

        stopBtn.addEventListener('click', () => {
            if (isRecording) {
                window.stopRecording(); // Call the stop function we defined earlier
            }
        });

        const form = dialog.querySelector('#verse-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = form.querySelector('.submit-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Updating...';

            try {
                const formData = new FormData(form);
                const updatedVerseData = {
                    verse: formData.get('verse'),
                    chand: formData.get('chand'),
                    book: formData.get('book'),
                    reference: formData.get('reference'),
                    subject: formData.get('subject'),
                    tags: formData.get('tags').split(',').map(tag => tag.trim()),
                    meaning: formData.get('meaning'),
                    updatedAt: new Date().toISOString()
                };

                // Only update audioData if a new recording was made
                if (recordedAudioBase64) {
                    updatedVerseData.audioData = recordedAudioBase64;
                }

                await updateVerse(verseId, updatedVerseData);
                document.body.removeChild(dialog);
                await renderVerses();
                await renderRecentVerses();
            } catch (error) {
                console.error("Error updating verse:", error);
                showToast('Error updating verse');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Update Verse';
            }
        });

        dialog.querySelector('.cancel-btn').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });

        dialog.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target === dialog.querySelector('.modal-overlay')) {
                document.body.removeChild(dialog);
            }
        });
    } catch (error) {
        console.error("Error in edit verse:", error);
        showToast('Error loading verse details');
    }
}

// Update the confirmDelete function
function confirmDelete(verseId) {
    const dialog = document.createElement('div');
    dialog.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content animate-in">
                <h2>Delete Verse</h2>
                <p>To delete this verse, please type "Hare Krishna" in the box below:</p>
                <input type="text" id="delete-confirmation" class="confirmation-input" placeholder="Type 'Hare Krishna'" style="width: 100%; padding: 12px; margin: 16px 0; border: 1px solid var(--deep-saffron); border-radius: 8px;">
                <div class="button-group">
                    <button class="cancel-btn">Cancel</button>
                    <button class="submit-btn" style="background: var(--maroon);" disabled>Delete</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    const deleteInput = dialog.querySelector('#delete-confirmation');
    const deleteButton = dialog.querySelector('.submit-btn');

    // Enable/disable delete button based on input
    deleteInput.addEventListener('input', (e) => {
        deleteButton.disabled = e.target.value !== 'Hare Krishna';
    });

    deleteButton.addEventListener('click', async () => {
        if (deleteInput.value === 'Hare Krishna') {
            try {
                await deleteVerse(verseId);
                document.body.removeChild(dialog);
                await renderVerses();
                await renderRecentVerses();
            } catch (error) {
                console.error("Error deleting verse:", error);
                showToast('Error deleting verse: ' + error.message);
            }
        }
    });

    dialog.querySelector('.cancel-btn').addEventListener('click', () => {
        document.body.removeChild(dialog);
    });

    dialog.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target === dialog.querySelector('.modal-overlay')) {
            document.body.removeChild(dialog);
        }
    });
}

async function filterVerses(type, value = null) {
    const verses = await getVerses();
    const versesTitle = document.querySelector('.verses-title');
    const versesGrid = document.querySelector('.verses-grid');
    const backButton = document.querySelector('.back-button');

    if (type === 'all') {
        versesTitle.textContent = 'Verses';
        versesTitle.classList.remove('category-view');
        backButton.style.display = 'none';
        renderFilteredVerses(verses);
        return;
    }

    if (!value) {
        // Show category list
        const items = [...new Set(verses.map(v => {
            switch(type) {
                case 'chand': return v.chand;
                case 'book': return v.book;
                case 'subject': return v.subject;
                case 'tags': return v.tags ? v.tags : [];
                default: return [];
            }
        }).flat())];
        
        showCategoryList(items, type);
        versesTitle.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)}s`;
        versesTitle.classList.remove('category-view');
        backButton.style.display = 'none';
    } else {
        // Show filtered verses
        let filteredVerses = verses.filter(verse => {
            return (
                verse.verse?.toLowerCase().includes(value.toLowerCase()) ||
                verse.book?.toLowerCase().includes(value.toLowerCase()) ||
                verse.chand?.toLowerCase().includes(value.toLowerCase()) ||
                verse.subject?.toLowerCase().includes(value.toLowerCase()) ||
                verse.meaning?.toLowerCase().includes(value.toLowerCase()) ||
                verse.reference?.toLowerCase().includes(value.toLowerCase()) ||
                verse.tags?.some(tag => tag.toLowerCase().includes(value.toLowerCase()))
            );
        });

        // Apply category filter if not 'all'
        if (type !== 'all') {
            filteredVerses = filteredVerses.filter(verse => {
                switch(type) {
                    case 'chand':
                        return verse.chand;
                    case 'book':
                        return verse.book;
                    case 'subject':
                        return verse.subject;
                    case 'tags':
                        return verse.tags && verse.tags.length > 0;
                    default:
                        return true;
                }
            });
        }

        versesTitle.textContent = value;
        versesTitle.classList.add('category-view');
        backButton.style.display = 'flex';
        renderFilteredVerses(filteredVerses);
    }
}

// Update renderFilteredVerses to handle display modes
async function renderFilteredVerses(verses) {
    const versesGrid = document.querySelector('.verses-grid');
    if (verses.length === 0) {
        versesGrid.innerHTML = '<div class="no-verses">No verses found</div>';
        return;
    }

    // Get display mode from active button
    const verseOnlyMode = document.querySelector('.display-option[data-display="verse-only"]').classList.contains('active');
    const verseMeaningMode = document.querySelector('.display-option[data-display="both"]').classList.contains('active');

    versesGrid.innerHTML = verses.map(verse => {
        if (verseOnlyMode) {
            // Show only verse, book and reference
            return `
                <div class="verse-item">
                    <div class="verse-source">${verse.book || 'Unknown Book'}${verse.reference ? ` - ${verse.reference}` : ''}</div>
                    <div class="verse-text">${verse.verse || ''}</div>
                </div>
            `;
        } else if (verseMeaningMode) {
            // Show verse, meaning, book and reference
            return `
                <div class="verse-item">
                    <div class="verse-source">${verse.book || 'Unknown Book'}${verse.reference ? ` - ${verse.reference}` : ''}</div>
                    <div class="verse-text">${verse.verse || ''}</div>
                    ${verse.meaning ? `
                        <div class="meaning-section">
                            <button class="meaning-toggle" onclick="this.nextElementSibling.classList.toggle('expanded'); this.querySelector('.material-icons').style.transform = this.nextElementSibling.classList.contains('expanded') ? 'rotate(180deg)' : 'rotate(0deg)'">
                                <span>View Meaning & Explanation</span>
                                <span class="material-icons">expand_more</span>
                            </button>
                            <div class="meaning-content">
                                ${verse.meaning}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            // Show all details (default view)
            return `
                <div class="verse-item">
                    <div class="verse-source">${verse.book || 'Unknown Book'}${verse.reference ? ` - ${verse.reference}` : ''}</div>
                    <div class="verse-text">${verse.verse || ''}</div>
                    
                    ${verse.meaning ? `
                        <div class="meaning-section">
                            <button class="meaning-toggle" onclick="this.nextElementSibling.classList.toggle('expanded'); this.querySelector('.material-icons').style.transform = this.nextElementSibling.classList.contains('expanded') ? 'rotate(180deg)' : 'rotate(0deg)'">
                                <span>View Meaning & Explanation</span>
                                <span class="material-icons">expand_more</span>
                            </button>
                            <div class="meaning-content">
                                ${verse.meaning}
                            </div>
                        </div>
                    ` : ''}

                    <div class="verse-meta">
                        <div class="meta-item">
                            <span class="material-icons">music_note</span>
                            ${verse.chand || 'Unknown Chand'}
                        </div>
                        <div class="meta-item">
                            <span class="material-icons">auto_stories</span>
                            ${verse.book || 'Unknown Book'}
                        </div>
                        <div class="meta-item">
                            <span class="material-icons">category</span>
                            ${verse.subject || 'General'}
                        </div>
                    </div>

                    <div class="verse-tags">
                        ${(verse.tags || []).map(tag => `
                            <span class="tag">${tag}</span>
                        `).join('')}
                    </div>

                    <div class="verse-actions">
                        ${verse.audioData ? `
                            <div class="audio-player" id="player-${verse.id}"></div>
                        ` : ''}
                        <button class="action-btn copy-btn" data-verse="${verse.verse}" data-meaning="${verse.meaning || ''}" title="Copy verse">
                            <span class="material-icons">content_copy</span>
                        </button>
                        <button class="action-btn edit-btn" data-id="${verse.id}" title="Edit verse">
                            <span class="material-icons">edit</span>
                        </button>
                        <button class="action-btn delete-btn" data-id="${verse.id}" title="Delete verse">
                            <span class="material-icons">delete</span>
                        </button>
                    </div>
                </div>
            `;
        }
    }).join('');

    await initializeVerseCardFunctionality();
}

async function initializeVerseCardFunctionality() {
    // Add copy functionality
    document.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const verse = button.dataset.verse;
            const meaning = button.dataset.meaning;
            const textToCopy = meaning ? `${verse}\n\nMeaning & Explanation:\n${meaning}` : verse;
            try {
                await navigator.clipboard.writeText(textToCopy);
                showToast('Verse copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy text: ', err);
                showToast('Failed to copy verse');
            }
        });
    });

    // Add event listeners for edit and delete buttons
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const verseId = button.dataset.id;
            editVerse(verseId);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const verseId = button.dataset.id;
            confirmDelete(verseId);
        });
    });

    // Initialize audio players for verses with audio
    const verses = await getVerses();
    document.querySelectorAll('.audio-player').forEach(container => {
        const verseId = container.id.replace('player-', '');
        const verse = verses.find(v => v.id === verseId);
        if (verse && verse.audioData) {
            new AudioPlayer(verse.audioData, container);
        }
    });

    // Add event listeners for meaning toggle
    // Removed as now handled inline in the template
}

function showCategoryList(items, type) {
    const versesGrid = document.querySelector('.verses-grid');
    versesGrid.innerHTML = `
        <div class="category-list">
            ${items.map(item => `
                <div class="category-list-item" data-value="${item}" data-type="${type}">
                    <span class="material-icons">
                        ${getCategoryIcon(type)}
                    </span>
                    <span class="category-name">${item}</span>
                    <span class="material-icons">chevron_right</span>
                </div>
            `).join('')}
        </div>
    `;

    // Add click handlers for category items
    const categoryItems = document.querySelectorAll('.category-list-item');
    categoryItems.forEach(item => {
        item.addEventListener('click', () => {
            const value = item.getAttribute('data-value');
            const type = item.getAttribute('data-type');
            
            // Update title to show selected category
            const versesTitle = document.querySelector('.verses-title');
            versesTitle.textContent = `${value}`;
            
            // Get and render filtered verses
            filterVerses(type, value);
        });
    });
}

function getCategoryIcon(type) {
    switch(type) {
        case 'chand':
            return 'music_note';
        case 'book':
            return 'auto_stories';
        case 'subject':
            return 'category';
        case 'tags':
            return 'local_offer';
        default:
            return 'label';
    }
}

async function searchVerses(searchTerm, filterType = 'all') {
    try {
        const verses = await getVerses();
        const searchTermLower = searchTerm.toLowerCase();
        
        let filteredVerses = verses.filter(verse => {
            return (
                verse.verse?.toLowerCase().includes(searchTermLower) ||
                verse.book?.toLowerCase().includes(searchTermLower) ||
                verse.chand?.toLowerCase().includes(searchTermLower) ||
                verse.subject?.toLowerCase().includes(searchTermLower) ||
                verse.meaning?.toLowerCase().includes(searchTermLower) ||
                verse.reference?.toLowerCase().includes(searchTermLower) ||
                verse.tags?.some(tag => tag.toLowerCase().includes(searchTermLower))
            );
        });

        // Apply category filter if not 'all'
        if (filterType !== 'all') {
            filteredVerses = filteredVerses.filter(verse => {
                switch(filterType) {
                    case 'chand':
                        return verse.chand;
                    case 'book':
                        return verse.book;
                    case 'subject':
                        return verse.subject;
                    case 'tags':
                        return verse.tags && verse.tags.length > 0;
                    default:
                        return true;
                }
            });
        }

        renderFilteredVerses(filteredVerses);
    } catch (error) {
        console.error("Error searching verses:", error);
        showToast('Error searching verses');
    }
}

async function showChangePasswordModal() {
    const dialog = document.createElement('div');
    dialog.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content animate-in">
                <h2>Change Password</h2>
                <form id="change-password-form">
                    <div class="form-group">
                        <input type="password" name="currentPassword" placeholder="Current Password" required>
                    </div>
                    <div class="form-group">
                        <input type="password" name="newPassword" placeholder="New Password" required>
                        <span class="material-icons password-toggle">visibility_off</span>
                    </div>
                    <div class="form-group">
                        <input type="password" name="confirmPassword" placeholder="Confirm New Password" required>
                        <span class="material-icons password-toggle">visibility_off</span>
                    </div>
                    <div class="button-group">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="submit-btn">Update Password</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    // Add password visibility toggle functionality
    dialog.querySelectorAll('.password-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const input = toggle.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                toggle.textContent = 'visibility';
            } else {
                input.type = 'password';
                toggle.textContent = 'visibility_off';
            }
        });
    });

    const form = dialog.querySelector('#change-password-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = form.querySelector('[name="currentPassword"]').value;
        const newPassword = form.querySelector('[name="newPassword"]').value;
        const confirmPassword = form.querySelector('[name="confirmPassword"]').value;

        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match');
            return;
        }

        try {
            // Re-authenticate user
            const credential = EmailAuthProvider.credential(
                auth.currentUser.email,
                currentPassword
            );
            await auth.currentUser.reauthenticateWithCredential(credential);

            // Update password
            await auth.currentUser.updatePassword(newPassword);
            showToast('Password updated successfully');
            document.body.removeChild(dialog);
        } catch (error) {
            console.error("Error updating password:", error);
            showToast(error.message);
        }
    });

    dialog.querySelector('.cancel-btn').addEventListener('click', () => {
        document.body.removeChild(dialog);
    });

    dialog.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target === dialog.querySelector('.modal-overlay')) {
            document.body.removeChild(dialog);
        }
    });
}

// Update onAuthStateChanged handler
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        showAuthModal();
    } else {
        // Remove the blur effect
        document.getElementById('app').style.filter = 'none';
        
        // Remove any existing auth modal
        const existingModal = document.querySelector('.modal-overlay');
        if (existingModal) {
            existingModal.parentElement.remove();
        }
        
        // Update profile section
        const profileHeader = document.querySelector('.profile-header');
        if (profileHeader) {
            const emailDisplay = profileHeader.querySelector('.profile-info h2');
            const nameDisplay = profileHeader.querySelector('.profile-info .display-name');
            if (emailDisplay) emailDisplay.textContent = user.email;
            if (nameDisplay) nameDisplay.textContent = user.displayName || 'User';
        }
        
        // Load initial data
        await renderVerses();
        await renderRecentVerses();
    }
});

// Update DOMContentLoaded event listener to remove duplicate auth state handling
document.addEventListener('DOMContentLoaded', async () => {
    // Blur the main content initially
    document.getElementById('app').style.filter = 'blur(5px)';
    
    // Rest of the DOMContentLoaded code...
    // Remove the duplicate onAuthStateChanged listener here since we already have it above
});

// Tab Navigation
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

function switchTab(tabId) {
    // Remove active class from all tabs and contents
    navItems.forEach(item => item.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    // Add active class to selected tab and content
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const tabId = item.getAttribute('data-tab');
        switchTab(tabId);
    });
});

// Find the verses tab header and update it
const versesPageHeader = document.querySelector('.verses-page-header');
versesPageHeader.innerHTML = `
    <button class="back-button" style="display: none;" title="Back">
        <span class="material-icons"></span>
    </button>
    <div class="verses-title-container">
        <h2 class="verses-title">Verses</h2>
        <div class="verses-search">
            <span class="material-icons">search</span>
            <input type="text" placeholder="Search verses...">
            <button class="clear-search" style="display: none;">
                <span class="material-icons">close</span>
            </button>
        </div>
    </div>
`;

// Enhanced search functionality
const searchInput = versesPageHeader.querySelector('.verses-search input');
const clearSearchBtn = versesPageHeader.querySelector('.clear-search');
let searchTimeout;

// Update search functionality
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const searchTerm = e.target.value.trim();
    
    // Show/hide clear button based on input
    clearSearchBtn.style.display = searchTerm ? 'flex' : 'none';
    
    // Get active filter
    const activeFilter = document.querySelector('.filter-chip.active');
    const filterType = activeFilter ? activeFilter.getAttribute('data-filter') : 'all';
    
    searchTimeout = setTimeout(() => {
        if (searchTerm) {
            searchVerses(searchTerm, filterType);
        } else {
            filterVerses(filterType);
        }
    }, 300);
});

// Add clear search functionality
clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    const activeFilter = document.querySelector('.filter-chip.active');
    const filterType = activeFilter ? activeFilter.getAttribute('data-filter') : 'all';
    filterVerses(filterType);
});

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        const activeFilter = document.querySelector('.filter-chip.active');
        const filterType = activeFilter ? activeFilter.getAttribute('data-filter') : 'all';
        filterVerses(filterType);
    }
});

// Update filter chips click handlers to integrate with search
const filterChips = document.querySelectorAll('.filter-chip');
filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
        const filterType = chip.getAttribute('data-filter');
        const searchTerm = searchInput.value.trim();
        
        // Remove active class from all chips
        filterChips.forEach(c => c.classList.remove('active'));
        // Add active class to clicked chip
        chip.classList.add('active');
        
        if (searchTerm) {
            searchVerses(searchTerm, filterType);
        } else {
            filterVerses(filterType);
        }
    });
});

// Update category cards click handlers
const categoryCards = document.querySelectorAll('.category-card');
categoryCards.forEach(card => {
    card.addEventListener('click', () => {
        const categoryType = card.getAttribute('data-type');
        
        // Switch to verses tab
        switchTab('verses');
        
        // Filter verses by category
        filterVerses(categoryType);
    });
});

// FAB Button Animation
const fab = document.querySelector('.fab');
    
fab.addEventListener('click', () => {
    const dialog = document.createElement('div');
    dialog.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content animate-in">
                <h2>Add New Verse</h2>
                <form id="verse-form">
                    <textarea name="verse" placeholder="Enter verse text (Sanskrit/Hindi)" required></textarea>
                    
                    <div class="input-with-suggestions">
                        <input type="text" name="chand" placeholder="Chand (Meter)" required>
                        <div class="suggestions-dropdown">
                            <div class="suggestion-item" data-value="">
                                <span class="material-icons">music_note</span>
                                Loading...
                            </div>
                        </div>
                    </div>

                    <div class="input-with-suggestions">
                        <input type="text" name="book" placeholder="Book Name" required>
                        <div class="suggestions-dropdown">
                            <div class="suggestion-item" data-value="">
                                <span class="material-icons">auto_stories</span>
                                Loading...
                            </div>
                        </div>
                    </div>

                    <div class="input-with-suggestions">
                        <input type="text" name="reference" placeholder="Reference (e.g., Chapter/Verse)" required>
                        <div class="suggestions-dropdown">
                            <div class="suggestion-item" data-value="">
                                <span class="material-icons">bookmark</span>
                                Loading...
                            </div>
                        </div>
                    </div>

                    <div class="input-with-suggestions">
                        <input type="text" name="subject" placeholder="Subject" required>
                        <div class="suggestions-dropdown">
                            <div class="suggestion-item" data-value="">
                                <span class="material-icons">category</span>
                                Loading...
                            </div>
                        </div>
                    </div>

                    <div class="tags-input-container">
                        <input type="text" name="tags" placeholder="Tags (comma separated)" required>
                        <div class="tags-suggestions">
                            Loading tags...
                        </div>
                    </div>

                    <div class="audio-recording-section">
                        <div class="recording-controls">
                            <button type="button" class="record-btn" data-state="idle">
                                <span class="material-icons">mic</span>
                                <span class="btn-text">Record Recitation</span>
                            </button>
                            <button type="button" class="stop-btn" style="display: none;">
                                <span class="material-icons">stop</span>
                                <span class="btn-text">Stop Recording</span>
                            </button>
                        </div>
                        <div class="recording-status"></div>
                    </div>
                    <textarea name="meaning" placeholder="Meaning & Explanation" required></textarea>
                    <div class="button-group">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="submit-btn">Add Verse</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    getUniqueValues().then(uniqueValues => {
        // Update Chand suggestions
        dialog.querySelector('input[name="chand"]').closest('.input-with-suggestions').querySelector('.suggestions-dropdown').innerHTML = 
            uniqueValues.chands.map(chand => `
                <div class="suggestion-item" data-value="${chand}">
                    <span class="material-icons">music_note</span>
                    ${chand}
                </div>
            `).join('');

        // Update Book suggestions
        dialog.querySelector('input[name="book"]').closest('.input-with-suggestions').querySelector('.suggestions-dropdown').innerHTML = 
            uniqueValues.books.map(book => `
                <div class="suggestion-item" data-value="${book}">
                    <span class="material-icons">auto_stories</span>
                    ${book}
                </div>
            `).join('');

        // Update Reference suggestions
        dialog.querySelector('input[name="reference"]').closest('.input-with-suggestions').querySelector('.suggestions-dropdown').innerHTML = 
            uniqueValues.references.map(ref => `
                <div class="suggestion-item" data-value="${ref}">
                    <span class="material-icons">bookmark</span>
                    ${ref}
                </div>
            `).join('');

        // Update Subject suggestions
        dialog.querySelector('input[name="subject"]').closest('.input-with-suggestions').querySelector('.suggestions-dropdown').innerHTML = 
            uniqueValues.subjects.map(subject => `
                <div class="suggestion-item" data-value="${subject}">
                    <span class="material-icons">category</span>
                    ${subject}
                </div>
            `).join('');

        // Update Tags suggestions
        dialog.querySelector('.tags-suggestions').innerHTML = 
            uniqueValues.tags.map(tag => `
                <span class="tag-suggestion" data-tag="${tag}">${tag}</span>
            `).join('');

        // Setup suggestion handlers after updating content
        setupSuggestionHandlers(dialog);

        // Add tag suggestion click handler
        const tagsInput = dialog.querySelector('input[name="tags"]');
        dialog.querySelectorAll('.tag-suggestion').forEach(tag => {
            tag.addEventListener('click', () => {
                const tagValue = tag.dataset.tag;
                const currentTags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);
                if (!currentTags.includes(tagValue)) {
                    currentTags.push(tagValue);
                    tagsInput.value = currentTags.join(', ');
                }
            });
        });
    });

    let isRecording = false;
    let recordedAudioBase64 = null;

    // Handle recording
    const recordBtn = dialog.querySelector('.record-btn');
    const stopBtn = dialog.querySelector('.stop-btn');
    const recordingStatus = dialog.querySelector('.recording-status');
    
    recordBtn.addEventListener('click', async () => {
        try {
            if (!isRecording) {
                // Start recording
                recordBtn.style.display = 'none';
                stopBtn.style.display = 'flex';
                isRecording = true;

                try {
                    recordedAudioBase64 = await recordAudio();
                    // Reset buttons after recording
                    recordBtn.style.display = 'flex';
                    stopBtn.style.display = 'none';
                    isRecording = false;
                } catch (error) {
                    showToast(error.message);
                    // Reset recording state
                    recordBtn.style.display = 'flex';
                    stopBtn.style.display = 'none';
                    isRecording = false;
                }
            }
        } catch (error) {
            console.error("Error in recording:", error);
            showToast("Recording failed: " + error.message);
            isRecording = false;
        }
    });

    stopBtn.addEventListener('click', () => {
        if (isRecording) {
            window.stopRecording(); // Call the stop function we defined earlier
        }
    });

    const form = dialog.querySelector('#verse-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = form.querySelector('.submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding...';

        try {
            const formData = new FormData(form);
            const verseData = {
                verse: formData.get('verse'),
                chand: formData.get('chand'),
                book: formData.get('book'),
                reference: formData.get('reference'),
                subject: formData.get('subject'),
                tags: formData.get('tags').split(',').map(tag => tag.trim()),
                audioData: recordedAudioBase64,
                meaning: formData.get('meaning'),
                createdAt: new Date().toISOString()
            };

            const newVerseId = await addVerse(verseData);

            document.body.removeChild(dialog);
            await renderVerses();
            await renderRecentVerses();
            showToast('Verse added successfully!');
        } catch (error) {
            console.error("Error in form submission:", error);
            showToast('Error adding verse: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Verse';
        }
    });

    dialog.querySelector('.cancel-btn').addEventListener('click', () => {
        document.body.removeChild(dialog);
    });

    dialog.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target === dialog.querySelector('.modal-overlay')) {
            document.body.removeChild(dialog);
        }
    });
});

// Add scroll to top functionality
const scrollToTopBtn = document.querySelector('.scroll-to-top');
    
// Show button when page is scrolled up 100px
window.addEventListener('scroll', () => {
    if (window.pageYOffset > 100) {
        scrollToTopBtn.classList.add('visible');
    } else {
        scrollToTopBtn.classList.remove('visible');
    }
});

// Smooth scroll to top when button is clicked
scrollToTopBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// Add logout functionality to profile section
const profileSection = document.querySelector('#profile');
if (profileSection) {
    const logoutButton = document.createElement('button');
    logoutButton.className = 'logout-btn';
    logoutButton.innerHTML = `
        <span class="material-icons">logout</span>
        <span>Logout</span>
    `;
    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
            showToast('Logged out successfully');
            showAuthModal();
        } catch (error) {
            showToast('Logout failed: ' + error.message);
        }
    });
    profileSection.querySelector('.profile-container').appendChild(logoutButton);
}

// Add change password button click handler
const changePasswordBtn = document.querySelector('.change-password-btn');
if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', showChangePasswordModal);
}

// Add these new functions after the existing functions
async function showEditProfileModal() {
    const user = auth.currentUser;
    if (!user) return;

    const dialog = document.createElement('div');
    dialog.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content animate-in">
                <h2>Edit Profile</h2>
                <form id="edit-profile-form">
                    <div class="form-group">
                        <input type="text" name="displayName" placeholder="Full Name" value="${user.displayName || ''}" required>
                    </div>
                    <div class="form-group">
                        <input type="email" name="email" placeholder="Email" value="${user.email}" required>
                    </div>
                    <div class="button-group">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="submit-btn">Update Profile</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    const form = dialog.querySelector('#edit-profile-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('.submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';

        try {
            const newDisplayName = form.querySelector('[name="displayName"]').value.trim();
            const newEmail = form.querySelector('[name="email"]').value.trim();

            // Update profile
            await updateProfile(auth.currentUser, {
                displayName: newDisplayName
            });

            // Update email if changed
            if (newEmail !== user.email) {
                await auth.currentUser.updateEmail(newEmail);
            }

            // Update UI
            const nameDisplay = document.querySelector('.profile-info .display-name');
            const emailDisplay = document.querySelector('.profile-info h2');
            if (nameDisplay) nameDisplay.textContent = newDisplayName;
            if (emailDisplay) emailDisplay.textContent = newEmail;

            showToast('Profile updated successfully');
            document.body.removeChild(dialog);
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast(error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Update Profile';
        }
    });

    dialog.querySelector('.cancel-btn').addEventListener('click', () => {
        document.body.removeChild(dialog);
    });

    dialog.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target === dialog.querySelector('.modal-overlay')) {
            document.body.removeChild(dialog);
        }
    });
}

async function exportVersesData() {
    try {
        const verses = await getVerses();
        if (!verses.length) {
            showToast('No verses to export');
            return;
        }

        // Create zip folder
        const zip = new JSZip();
        
        // Add CSV file
        const headers = ['Verse', 'Chand', 'Book', 'Reference', 'Subject', 'Tags', 'Meaning', 'Created At'];
        const csvRows = [headers];

        verses.forEach(verse => {
            csvRows.push([
                verse.verse || '',
                verse.chand || '',
                verse.book || '',
                verse.reference || '',
                verse.subject || '',
                (verse.tags || []).join('; '),
                verse.meaning || '',
                new Date(verse.createdAt).toLocaleString()
            ].map(cell => `"${cell.replace(/"/g, '""')}"`));
        });

        const csvContent = csvRows.join('\n');
        zip.file('verses_data.csv', csvContent);

        // Add MP3 files
        const audioFolder = zip.folder('audio_recordings');
        for (const verse of verses) {
            if (verse.audioData) {
                try {
                    // Convert base64 to blob
                    const response = await fetch(verse.audioData);
                    const audioBlob = await response.blob();
                    
                    // Generate filename using book and reference
                    let fileName = `${verse.book || 'Unknown'}_${verse.reference || 'NoRef'}.mp3`
                        .replace(/[^a-z0-9]/gi, '_') // Replace invalid characters with underscore
                        .toLowerCase();
                    
                    audioFolder.file(fileName, audioBlob);
                } catch (error) {
                    console.error(`Error processing audio for verse ${verse.id}:`, error);
                }
            }
        }

        // Generate the zip file
        const content = await zip.generateAsync({type: 'blob'});
        
        // Create download link
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `verses_export_${new Date().toISOString().slice(0,10)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Export completed');
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Error exporting data');
    }
}

// Add these event listeners after the existing event listeners
document.addEventListener('DOMContentLoaded', () => {
    const editProfileBtn = document.querySelector('.edit-profile-btn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', showEditProfileModal);
    }

    const exportDataBtn = document.querySelector('.export-data-btn');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', exportVersesData);
    }
});

// Add function to get unique values
async function getUniqueValues() {
    const verses = await getVerses();
    return {
        chands: [...new Set(verses.map(v => v.chand).filter(Boolean))],
        books: [...new Set(verses.map(v => v.book).filter(Boolean))],
        references: [...new Set(verses.map(v => v.reference).filter(Boolean))],
        subjects: [...new Set(verses.map(v => v.subject).filter(Boolean))],
        tags: [...new Set(verses.flatMap(v => v.tags || []).filter(Boolean))]
    };
}

// Update showAuthModal to include the new auth modal
function showAuthModal() {
    // Remove any existing auth modal first
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
        existingModal.parentElement.remove();
    }
    
    document.getElementById('app').style.filter = 'blur(5px)';
    
    const dialog = document.createElement('div');
    dialog.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content auth-modal animate-in">
                <div class="auth-tabs">
                    <button class="auth-tab active" data-tab="login">Login</button>
                    <button class="auth-tab" data-tab="register">Register</button>
                </div>
                
                <form id="login-form" class="auth-form active">
                    <h2>Welcome Back!</h2>
                    <div class="form-group">
                        <input type="email" name="email" placeholder="Email" required>
                    </div>
                    <div class="form-group">
                        <input type="password" name="password" placeholder="Password" required>
                        <span class="material-icons password-toggle">visibility_off</span>
                    </div>
                    <button type="submit" class="submit-btn">Login</button>
                </form>

                <form id="register-form" class="auth-form">
                    <h2>Create Account</h2>
                    <div class="form-group">
                        <input type="text" name="displayName" placeholder="Full Name" required>
                    </div>
                    <div class="form-group">
                        <input type="email" name="email" placeholder="Email" required>
                    </div>
                    <div class="form-group">
                        <input type="password" name="password" placeholder="Password" required>
                        <span class="material-icons password-toggle">visibility_off</span>
                    </div>
                    <div class="form-group">
                        <input type="password" name="confirmPassword" placeholder="Confirm Password" required>
                        <span class="material-icons password-toggle">visibility_off</span>
                    </div>
                    <button type="submit" class="submit-btn">Register</button>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    // Handle tab switching
    const tabs = dialog.querySelectorAll('.auth-tab');
    const forms = dialog.querySelectorAll('.auth-form');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const formId = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            forms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${formId}-form`) {
                    form.classList.add('active');
                }
            });
        });
    });

    // Add password visibility toggle functionality
    dialog.querySelectorAll('.password-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const input = toggle.previousElementSibling;
            if (input && input.type) {
                if (input.type === 'password') {
                    input.type = 'text';
                    toggle.textContent = 'visibility';
                } else {
                    input.type = 'password';
                    toggle.textContent = 'visibility_off';
                }
            }
        });
    });

    // Handle login
    const loginForm = dialog.querySelector('#login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = loginForm.querySelector('input[name="email"]');
            const passwordInput = loginForm.querySelector('input[name="password"]');
            
            if (!emailInput || !passwordInput) {
                showToast('Error: Form inputs not found');
                return;
            }

            try {
                const email = emailInput.value.trim();
                const password = passwordInput.value;
                
                if (!email || !password) {
                    showToast('Please fill in all fields');
                    return;
                }

                await signInWithEmailAndPassword(auth, email, password);
                // Modal will be cleaned up by onAuthStateChanged
                showToast('Login successful!');
            } catch (error) {
                console.error('Login error:', error);
                showToast('Login failed: ' + error.message);
            }
        });
    }

    // Handle registration
    const registerForm = dialog.querySelector('#register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const displayNameInput = registerForm.querySelector('input[name="displayName"]');
            const emailInput = registerForm.querySelector('input[name="email"]');
            const passwordInput = registerForm.querySelector('input[name="password"]');
            const confirmPasswordInput = registerForm.querySelector('input[name="confirmPassword"]');
            const submitBtn = registerForm.querySelector('.submit-btn');

            if (!displayNameInput || !emailInput || !passwordInput || !confirmPasswordInput) {
                showToast('Error: Form inputs not found');
                return;
            }

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Registering...';

                const displayName = displayNameInput.value.trim();
                const email = emailInput.value.trim();
                const password = passwordInput.value;
                const confirmPassword = confirmPasswordInput.value;

                if (!displayName || !email || !password || !confirmPassword) {
                    showToast('Please fill in all fields');
                    return;
                }

                if (password !== confirmPassword) {
                    showToast('Passwords do not match');
                    return;
                }

                // Create user first
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                // Update profile using the new method
                await updateProfile(userCredential.user, {
                    displayName: displayName
                });

                // Update email if changed
                if (email !== userCredential.user.email) {
                    await userCredential.user.updateEmail(email);
                }

                // Successfully registered and profile updated
                showToast('Registration successful!');
                
                // Update UI immediately 
                const profileHeader = document.querySelector('.profile-header');
                if (profileHeader) {
                    const emailDisplay = profileHeader.querySelector('.profile-info h2');
                    const nameDisplay = profileHeader.querySelector('.profile-info .display-name');
                    if (emailDisplay) emailDisplay.textContent = email;
                    if (nameDisplay) nameDisplay.textContent = displayName;
                }

                // Remove modal and blur
                document.body.removeChild(dialog);
                document.getElementById('app').style.filter = 'none';

            } catch (error) {
                console.error('Registration error:', error);
                let errorMessage = 'Registration failed';
                
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = 'This email is already registered';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Invalid email address';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'Password is too weak (minimum 6 characters)';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = 'Network error. Please check your connection';
                        break;
                    default:
                        errorMessage = error.message;
                }
                
                showToast(errorMessage);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Register';
            }
        });
    }

    // Prevent closing modal by clicking overlay when not logged in
    dialog.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (auth.currentUser) {
            if (e.target === dialog.querySelector('.modal-overlay')) {
                document.body.removeChild(dialog);
                document.getElementById('app').style.filter = 'none';
            }
        }
    });
}

const createInputWithSuggestions = (name, placeholder, icon, value = '', suggestions = []) => `
    <div class="input-with-suggestions">
        <input type="text" name="${name}" placeholder="${placeholder}" required value="${value}">
        <div class="suggestions-dropdown">
            ${suggestions.map(suggestion => `
                <div class="suggestion-item" data-value="${suggestion}">
                    <span class="material-icons">${icon}</span>
                    ${suggestion}
                </div>
            `).join('')}
        </div>
    </div>
`;

const setupSuggestionHandlers = (container) => {
    container.querySelectorAll('.input-with-suggestions').forEach(wrapper => {
        const input = wrapper.querySelector('input');
        const dropdown = wrapper.querySelector('.suggestions-dropdown');
        
        // Show dropdown on input focus
        input.addEventListener('focus', () => {
            dropdown.classList.add('show');
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });

        // Handle suggestion clicks
        wrapper.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                input.value = item.dataset.value;
                dropdown.classList.remove('show');
                // Trigger input event to update any dependent logic
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
        });

        // Filter suggestions based on input
        input.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase();
            wrapper.querySelectorAll('.suggestion-item').forEach(item => {
                const matches = item.textContent.toLowerCase().includes(value);
                item.style.display = matches ? 'flex' : 'none';
            });
        });
    });

    // Add special handling for tags input
    const tagsInput = container.querySelector('input[name="tags"]');
    if (tagsInput) {
        const tagsContainer = container.querySelector('.tags-suggestions');
        let allTags = [...tagsContainer.querySelectorAll('.tag-suggestion')]
            .map(tag => tag.dataset.tag);

        tagsInput.addEventListener('input', (e) => {
            const currentTags = e.target.value.split(',').map(t => t.trim());
            const currentTag = currentTags[currentTags.length - 1].toLowerCase();

            // Filter and show matching tags
            const matchingTags = allTags.filter(tag => 
                tag.toLowerCase().includes(currentTag) && 
                !currentTags.slice(0, -1).includes(tag)
            );

            // Update suggestions visibility
            tagsContainer.querySelectorAll('.tag-suggestion').forEach(tag => {
                const tagValue = tag.dataset.tag;
                if (matchingTags.includes(tagValue)) {
                    tag.style.display = 'inline-block';
                    tag.classList.add('matching');
                } else {
                    tag.style.display = 'inline-block';
                    tag.classList.remove('matching');
                }
            });
        });

        // Update tag click handler to handle partial input
        container.querySelectorAll('.tag-suggestion').forEach(tag => {
            tag.addEventListener('click', () => {
                const tagValue = tag.dataset.tag;
                const currentTags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);
                
                // Remove the last partial tag if it exists
                if (currentTags.length > 0 && currentTags[currentTags.length - 1].includes(tagValue)) {
                    currentTags.pop();
                }
                
                if (!currentTags.includes(tagValue)) {
                    currentTags.push(tagValue);
                    tagsInput.value = currentTags.join(', ');
                    tagsInput.focus();
                }
            });
        });
    }
};

let currentDisplayMode = null; 

// Update event listeners for display options 
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.display-option').forEach(option => {
        option.addEventListener('click', () => {
            const displayMode = option.getAttribute('data-display');
            
            // If clicking the already active option, deactivate it
            if (currentDisplayMode === displayMode) {
                currentDisplayMode = null;
                option.classList.remove('active');
            } else {
                // Deactivate all options first
                document.querySelectorAll('.display-option').forEach(opt => opt.classList.remove('active'));
                // Activate clicked option
                option.classList.add('active');
                currentDisplayMode = displayMode;
            }
            
            // Rerender current verses with new display mode
            const searchTerm = document.querySelector('.verses-search input').value.trim();
            const activeFilter = document.querySelector('.filter-chip.active');
            const filterType = activeFilter ? activeFilter.getAttribute('data-filter') : 'all';
            
            if (searchTerm) {
                searchVerses(searchTerm, filterType);
            } else {
                filterVerses(filterType);
            }
        });
    });
});
