// Global state
let profiles = [];
let isLoading = false;
let hasMore = true;
let skip = 0;
const limit = 10;
let expandedProfiles = new Set();

// API Configuration
const BACKEND_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8001/api' 
    : 'https://6ae7ad66-49fc-4f13-8adb-3983820800bd.preview.emergentagent.com/api';

// DOM Elements
let elements = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    setupEventListeners();
    setupInfiniteScroll();
    loadProfiles(0, true);
});

// Initialize DOM element references
function initializeElements() {
    elements = {
        profileList: document.getElementById('profileList'),
        loadingIndicator: document.getElementById('loadingIndicator'),
        endOfListMessage: document.getElementById('endOfListMessage'),
        scrollTrigger: document.getElementById('scrollTrigger'),
        addProfileBtn: document.getElementById('addProfileBtn'),
        uploadModal: document.getElementById('uploadModal'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        profileForm: document.getElementById('profileForm'),
        cancelBtn: document.getElementById('cancelBtn'),
        submitBtn: document.getElementById('submitBtn'),
        submitText: document.getElementById('submitText'),
        submitSpinner: document.getElementById('submitSpinner'),
        addContentBtn: document.getElementById('addContentBtn'),
        contentItems: document.getElementById('contentItems'),
        profileAvatar: document.getElementById('profileAvatar'),
        avatarPreview: document.getElementById('avatarPreview'),
        avatarImage: document.getElementById('avatarImage'),
        successMessage: document.getElementById('successMessage'),
        errorMessage: document.getElementById('errorMessage'),
        errorText: document.getElementById('errorText')
    };
}

// Setup event listeners
function setupEventListeners() {
    // Modal controls
    elements.addProfileBtn.addEventListener('click', openModal);
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.cancelBtn.addEventListener('click', closeModal);
    
    // Modal backdrop click
    elements.uploadModal.addEventListener('click', function(e) {
        if (e.target === elements.uploadModal || e.target.classList.contains('modal-backdrop')) {
            closeModal();
        }
    });
    
    // Form submission
    elements.profileForm.addEventListener('submit', handleFormSubmit);
    
    // Content management
    elements.addContentBtn.addEventListener('click', addContentItem);
    
    // Avatar preview
    elements.profileAvatar.addEventListener('change', handleAvatarChange);
    
    // Escape key to close modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !elements.uploadModal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

// Setup infinite scroll
function setupInfiniteScroll() {
    const observer = new IntersectionObserver(
        (entries) => {
            if (entries[0].isIntersecting && hasMore && !isLoading) {
                loadProfiles(skip);
            }
        },
        { threshold: 1.0 }
    );
    
    observer.observe(elements.scrollTrigger);
}

// Load profiles from API
async function loadProfiles(skipCount, reset = false) {
    if (isLoading) return;
    
    isLoading = true;
    showLoading();
    
    try {
        const response = await fetch(`${BACKEND_URL}/profiles?skip=${skipCount}&limit=${limit}`);
        if (!response.ok) throw new Error('Failed to load profiles');
        
        const newProfiles = await response.json();
        
        if (reset) {
            profiles = newProfiles;
            elements.profileList.innerHTML = '';
            expandedProfiles.clear();
        } else {
            profiles = [...profiles, ...newProfiles];
        }
        
        renderProfiles(newProfiles);
        
        skip = skipCount + limit;
        hasMore = newProfiles.length === limit;
        
        if (!hasMore) {
            elements.endOfListMessage.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error('Error loading profiles:', error);
        showError('Failed to load profiles. Please try again.');
    } finally {
        isLoading = false;
        hideLoading();
    }
}

// Render profiles
function renderProfiles(profilesToRender) {
    profilesToRender.forEach(profile => {
        const profileElement = createProfileElement(profile);
        elements.profileList.appendChild(profileElement);
        
        // Add fade-in animation
        requestAnimationFrame(() => {
            profileElement.classList.add('fade-in');
        });
    });
}

// Create profile element
function createProfileElement(profile) {
    const profileDiv = document.createElement('div');
    profileDiv.className = 'profile-card';
    profileDiv.dataset.profileId = profile.id;
    
    const isExpanded = expandedProfiles.has(profile.id);
    
    profileDiv.innerHTML = `
        <div class="profile-header" onclick="toggleProfile('${profile.id}')">
            <div class="profile-header-content">
                <div class="profile-avatar">
                    ${profile.avatar 
                        ? `<img src="data:image/jpeg;base64,${profile.avatar}" alt="${profile.name}">`
                        : profile.name.charAt(0).toUpperCase()
                    }
                </div>
                <div class="profile-info">
                    <div class="profile-name">${escapeHtml(profile.name)}</div>
                    <div class="profile-email">${escapeHtml(profile.email)}</div>
                    ${profile.bio ? `<div class="profile-bio">${escapeHtml(profile.bio)}</div>` : ''}
                </div>
                <div class="profile-meta">
                    <span>${profile.content_items?.length || 0} items</span>
                    <svg class="expand-icon ${isExpanded ? 'expanded' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                </div>
            </div>
        </div>
        <div class="profile-content ${isExpanded ? 'expanded' : ''}">
            ${renderProfileContent(profile)}
        </div>
    `;
    
    return profileDiv;
}

// Render profile content
function renderProfileContent(profile) {
    if (!profile.content_items || profile.content_items.length === 0) {
        return '<div class="no-content">No content items yet</div>';
    }
    
    const contentHtml = profile.content_items.map(item => `
        <div class="content-item">
            <div class="content-item-header">
                <div class="content-item-title">${escapeHtml(item.title)}</div>
                <span class="content-type-badge ${item.type}">${item.type}</span>
            </div>
            <div class="content-item-body">
                ${renderContentItemBody(item)}
            </div>
            <div class="content-item-meta">
                <span>${formatDate(item.created_at)}</span>
                ${item.file_size ? `<span>${formatFileSize(item.file_size)}</span>` : ''}
            </div>
        </div>
    `).join('');
    
    return `<div class="content-items">${contentHtml}</div>`;
}

// Render content item body based on type
function renderContentItemBody(item) {
    switch (item.type) {
        case 'image':
            return `<img src="data:image/jpeg;base64,${item.content}" alt="${escapeHtml(item.title)}" loading="lazy">`;
        case 'video':
            return `<video controls preload="metadata">
                        <source src="data:video/mp4;base64,${item.content}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>`;
        case 'audio':
            return `<audio controls preload="metadata">
                        <source src="data:audio/mp3;base64,${item.content}" type="audio/mp3">
                        Your browser does not support the audio tag.
                    </audio>`;
        default:
            return `<p>${escapeHtml(item.content)}</p>`;
    }
}

// Toggle profile expansion
function toggleProfile(profileId) {
    const profileElement = document.querySelector(`[data-profile-id="${profileId}"]`);
    const contentElement = profileElement.querySelector('.profile-content');
    const expandIcon = profileElement.querySelector('.expand-icon');
    
    if (expandedProfiles.has(profileId)) {
        expandedProfiles.delete(profileId);
        contentElement.classList.remove('expanded');
        expandIcon.classList.remove('expanded');
    } else {
        expandedProfiles.add(profileId);
        contentElement.classList.add('expanded');
        expandIcon.classList.add('expanded');
    }
}

// Modal functions
function openModal() {
    elements.uploadModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // Focus first input
    setTimeout(() => {
        document.getElementById('profileName').focus();
    }, 100);
}

function closeModal() {
    elements.uploadModal.classList.add('hidden');
    document.body.style.overflow = '';
    resetForm();
}

function resetForm() {
    elements.profileForm.reset();
    elements.contentItems.innerHTML = '';
    elements.avatarPreview.classList.add('hidden');
    setSubmitButtonState(false);
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (isLoading) return;
    
    setSubmitButtonState(true);
    
    try {
        // Create profile
        const profileData = await createProfileData();
        const profileResponse = await fetch(`${BACKEND_URL}/profiles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(profileData)
        });
        
        if (!profileResponse.ok) throw new Error('Failed to create profile');
        
        const createdProfile = await profileResponse.json();
        
        // Upload content items
        await uploadContentItems(createdProfile.id);
        
        showSuccess('Profile created successfully!');
        closeModal();
        refreshProfiles();
        
    } catch (error) {
        console.error('Error creating profile:', error);
        showError('Failed to create profile. Please try again.');
    } finally {
        setSubmitButtonState(false);
    }
}

// Create profile data from form
async function createProfileData() {
    const formData = new FormData(elements.profileForm);
    const profileData = {
        name: formData.get('name'),
        email: formData.get('email'),
        bio: formData.get('bio') || null
    };
    
    // Handle avatar
    const avatarFile = formData.get('avatar');
    if (avatarFile && avatarFile.size > 0) {
        profileData.avatar = await fileToBase64(avatarFile);
    }
    
    return profileData;
}

// Upload content items
async function uploadContentItems(profileId) {
    const contentItemElements = elements.contentItems.querySelectorAll('.content-item-form');
    
    for (const itemElement of contentItemElements) {
        const title = itemElement.querySelector('[name="title"]').value;
        const type = itemElement.querySelector('[name="type"]').value;
        
        if (!title) continue;
        
        const formData = new FormData();
        formData.append('title', title);
        formData.append('content_type', type);
        
        if (type === 'text') {
            const textContent = itemElement.querySelector('[name="content"]').value;
            if (textContent) {
                formData.append('text_content', textContent);
            }
        } else {
            const fileInput = itemElement.querySelector('[name="file"]');
            if (fileInput && fileInput.files[0]) {
                formData.append('file', fileInput.files[0]);
            }
        }
        
        const response = await fetch(`${BACKEND_URL}/profiles/${profileId}/content`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            console.error('Failed to upload content item:', title);
        }
    }
}

// Content item management
function addContentItem() {
    const contentItemId = Date.now();
    const contentItemDiv = document.createElement('div');
    contentItemDiv.className = 'content-item-form';
    contentItemDiv.dataset.itemId = contentItemId;
    
    contentItemDiv.innerHTML = `
        <div class="content-item-form-header">
            <select name="type" onchange="handleContentTypeChange(${contentItemId})">
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
            </select>
            <button type="button" class="remove-content-btn" onclick="removeContentItem(${contentItemId})">
                Remove
            </button>
        </div>
        <div class="form-group">
            <input type="text" name="title" placeholder="Title" required>
        </div>
        <div class="content-input-area">
            <div class="form-group">
                <textarea name="content" placeholder="Content" rows="3"></textarea>
            </div>
        </div>
    `;
    
    elements.contentItems.appendChild(contentItemDiv);
    
    // Focus the title input
    contentItemDiv.querySelector('[name="title"]').focus();
}

function removeContentItem(itemId) {
    const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
    if (itemElement) {
        itemElement.remove();
    }
}

function handleContentTypeChange(itemId) {
    const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
    const typeSelect = itemElement.querySelector('[name="type"]');
    const contentInputArea = itemElement.querySelector('.content-input-area');
    
    const type = typeSelect.value;
    
    if (type === 'text') {
        contentInputArea.innerHTML = `
            <div class="form-group">
                <textarea name="content" placeholder="Content" rows="3"></textarea>
            </div>
        `;
    } else {
        const acceptMap = {
            image: 'image/*',
            video: 'video/*',
            audio: 'audio/*'
        };
        
        contentInputArea.innerHTML = `
            <div class="form-group">
                <input type="file" name="file" accept="${acceptMap[type]}" required>
            </div>
        `;
    }
}

// Avatar handling
function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            elements.avatarImage.src = e.target.result;
            elements.avatarPreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        elements.avatarPreview.classList.add('hidden');
    }
}

// Utility functions
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function showLoading() {
    elements.loadingIndicator.classList.remove('hidden');
}

function hideLoading() {
    elements.loadingIndicator.classList.add('hidden');
}

function setSubmitButtonState(loading) {
    if (loading) {
        elements.submitBtn.disabled = true;
        elements.submitText.textContent = 'Creating...';
        elements.submitSpinner.classList.remove('hidden');
    } else {
        elements.submitBtn.disabled = false;
        elements.submitText.textContent = 'Create Profile';
        elements.submitSpinner.classList.add('hidden');
    }
}

function showSuccess(message) {
    elements.successMessage.querySelector('span').textContent = message;
    elements.successMessage.classList.remove('hidden');
    elements.successMessage.classList.add('show');
    
    setTimeout(() => {
        elements.successMessage.classList.remove('show');
        setTimeout(() => {
            elements.successMessage.classList.add('hidden');
        }, 300);
    }, 3000);
}

function showError(message) {
    elements.errorText.textContent = message;
    elements.errorMessage.classList.remove('hidden');
    elements.errorMessage.classList.add('show');
    
    setTimeout(() => {
        elements.errorMessage.classList.remove('show');
        setTimeout(() => {
            elements.errorMessage.classList.add('hidden');
        }, 300);
    }, 5000);
}

function refreshProfiles() {
    skip = 0;
    hasMore = true;
    elements.endOfListMessage.classList.add('hidden');
    loadProfiles(0, true);
}

// Make functions globally available
window.toggleProfile = toggleProfile;
window.removeContentItem = removeContentItem;
window.handleContentTypeChange = handleContentTypeChange;
