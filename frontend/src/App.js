import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const App = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [expandedProfile, setExpandedProfile] = useState(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [skip, setSkip] = useState(0);
  const limit = 10;
  const observerRef = useRef();

  // Load initial profiles
  useEffect(() => {
    loadProfiles(0, true);
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadProfiles(skip);
        }
      },
      { threshold: 1.0 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [skip, hasMore, loading]);

  const loadProfiles = async (skipCount, reset = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API}/profiles?skip=${skipCount}&limit=${limit}`);
      const newProfiles = response.data;
      
      if (reset) {
        setProfiles(newProfiles);
      } else {
        setProfiles(prev => [...prev, ...newProfiles]);
      }
      
      setSkip(skipCount + limit);
      setHasMore(newProfiles.length === limit);
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleProfile = (profileId) => {
    setExpandedProfile(expandedProfile === profileId ? null : profileId);
  };

  const refreshProfiles = () => {
    setSkip(0);
    setHasMore(true);
    loadProfiles(0, true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">User Profiles</h1>
          <button
            onClick={() => setShowUploadForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Add Profile
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Upload Form Modal */}
        {showUploadForm && (
          <UploadForm 
            onClose={() => setShowUploadForm(false)}
            onSuccess={refreshProfiles}
          />
        )}

        {/* Profile List */}
        <div className="space-y-4">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isExpanded={expandedProfile === profile.id}
              onToggle={() => toggleProfile(profile.id)}
            />
          ))}
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Infinite Scroll Trigger */}
        <div ref={observerRef} className="h-4"></div>

        {/* End of List */}
        {!hasMore && profiles.length > 0 && (
          <div className="text-center py-8 text-gray-500">
            No more profiles to load
          </div>
        )}
      </main>
    </div>
  );
};

const ProfileCard = ({ profile, isExpanded, onToggle }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderContent = (item) => {
    switch (item.type) {
      case 'image':
        return (
          <img
            src={`data:image/jpeg;base64,${item.content}`}
            alt={item.title}
            className="max-w-full h-auto rounded-lg"
          />
        );
      case 'video':
        return (
          <video
            controls
            className="max-w-full h-auto rounded-lg"
          >
            <source src={`data:video/mp4;base64,${item.content}`} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        );
      case 'audio':
        return (
          <audio controls className="w-full">
            <source src={`data:audio/mp3;base64,${item.content}`} type="audio/mp3" />
            Your browser does not support the audio tag.
          </audio>
        );
      default:
        return <p className="text-gray-700">{item.content}</p>;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
      {/* Profile Header */}
      <div
        className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center space-x-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
            {profile.avatar ? (
              <img
                src={`data:image/jpeg;base64,${profile.avatar}`}
                alt={profile.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              profile.name.charAt(0).toUpperCase()
            )}
          </div>
          
          {/* Profile Info */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800">{profile.name}</h3>
            <p className="text-gray-600">{profile.email}</p>
            {profile.bio && (
              <p className="text-sm text-gray-500 mt-1">{profile.bio}</p>
            )}
          </div>

          {/* Expand/Collapse Icon */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {profile.content_items.length} items
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-gray-100">
          <div className="mt-4 space-y-4">
            {profile.content_items.length > 0 ? (
              profile.content_items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-800">{item.title}</h4>
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                      {item.type}
                    </span>
                  </div>
                  <div className="mb-2">
                    {renderContent(item)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(item.created_at)}
                    {item.file_size && (
                      <span className="ml-2">
                        ({Math.round(item.file_size / 1024)} KB)
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">
                No content items yet
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const UploadForm = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: ''
  });
  const [avatar, setAvatar] = useState(null);
  const [contentItems, setContentItems] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatar(e.target.result.split(',')[1]); // Remove data:image/jpeg;base64, prefix
      };
      reader.readAsDataURL(file);
    }
  };

  const addContentItem = () => {
    setContentItems([
      ...contentItems,
      { id: Date.now(), type: 'text', title: '', content: '', file: null }
    ]);
  };

  const updateContentItem = (id, field, value) => {
    setContentItems(contentItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeContentItem = (id) => {
    setContentItems(contentItems.filter(item => item.id !== id));
  };

  const handleFileChange = (id, file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      updateContentItem(id, 'file', file);
      updateContentItem(id, 'content', e.target.result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    try {
      // Create profile
      const profileData = {
        ...formData,
        avatar: avatar
      };

      const profileResponse = await axios.post(`${API}/profiles`, profileData);
      const profileId = profileResponse.data.id;

      // Upload content items
      for (const item of contentItems) {
        if (item.title && (item.content || item.file)) {
          const formData = new FormData();
          formData.append('title', item.title);
          formData.append('content_type', item.type);
          
          if (item.file) {
            formData.append('file', item.file);
          } else {
            formData.append('text_content', item.content);
          }

          await axios.post(`${API}/profiles/${profileId}/content`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating profile:', error);
      alert('Error creating profile. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Create Profile</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bio
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Avatar
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Content Items */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Content Items
                </label>
                <button
                  type="button"
                  onClick={addContentItem}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                >
                  Add Item
                </button>
              </div>

              {contentItems.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center mb-3">
                    <select
                      value={item.type}
                      onChange={(e) => updateContentItem(item.id, 'type', e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded"
                    >
                      <option value="text">Text</option>
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                      <option value="audio">Audio</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeContentItem(item.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Title"
                      value={item.title}
                      onChange={(e) => updateContentItem(item.id, 'title', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {item.type === 'text' ? (
                      <textarea
                        placeholder="Content"
                        value={item.content}
                        onChange={(e) => updateContentItem(item.id, 'content', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <input
                        type="file"
                        accept={item.type === 'image' ? 'image/*' : item.type === 'video' ? 'video/*' : 'audio/*'}
                        onChange={(e) => handleFileChange(item.id, e.target.files[0])}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {uploading ? 'Creating...' : 'Create Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default App;