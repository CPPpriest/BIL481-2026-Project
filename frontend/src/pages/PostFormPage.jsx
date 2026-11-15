import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { createPost, updatePost } from '../api/unihelpApi.js';

const SUBTYPES_BY_CATEGORY = {
  LOST_FOUND: [
    { value: 'LOST', label: 'Lost' },
    { value: 'FOUND', label: 'Found' },
  ],
  STUDENT_COOPERATION: [
    { value: 'BOOK', label: 'Book' },
    { value: 'ROOMMATE', label: 'Roommate' },
    { value: 'OTHER', label: 'Other' },
  ],
};

const MAX_IMAGE_BYTES = 5_000_000;

export default function PostFormPage({ initialValues = null, onSaved }) {
  const { id } = useParams();
  const isEditMode = Boolean(id || initialValues?.id);

  const [category, setCategory] = useState(initialValues?.category || 'LOST_FOUND');
  const [subtype, setSubtype] = useState(initialValues?.subtype || 'LOST');
  const [title, setTitle] = useState(initialValues?.title || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [locationText, setLocationText] = useState(initialValues?.locationText || '');
  const [imageFile, setImageFile] = useState(null);
  const [feedback, setFeedback] = useState('');

  function handleCategoryChange(nextCategory) {
    setCategory(nextCategory);
    setSubtype(SUBTYPES_BY_CATEGORY[nextCategory][0].value);
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0] || null;
    if (!file) { setImageFile(null); return; }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setFeedback('Only JPEG or PNG images are allowed (FR-10).');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFeedback('Image size must not exceed 5 MB (FR-10).');
      event.target.value = '';
      return;
    }
    setFeedback('');
    setImageFile(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback('');
    const payload = {
      category,
      subtype,
      title: title.trim(),
      description: description.trim(),
      locationText: locationText.trim() || null,
    };
    try {
      const saved = isEditMode
        ? await updatePost(id || initialValues.id, payload, imageFile)
        : await createPost(payload, imageFile);
      setFeedback(`Saved post #${saved.id}`);
      onSaved?.(saved);
    } catch (error) {
      setFeedback(error.message);
    }
  }

  return (
    <section className="panel" aria-labelledby="post-form-heading">
      <h1 id="post-form-heading">{isEditMode ? 'Edit Post' : 'Create Post'}</h1>
      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="field-group">
          <label htmlFor="post-category">Category</label>
          <select id="post-category" value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
            <option value="LOST_FOUND">Lost &amp; Found</option>
            <option value="STUDENT_COOPERATION">Student Cooperation</option>
          </select>
        </div>
        <div className="field-group">
          <label htmlFor="post-subtype">Sub-type</label>
          <select id="post-subtype" value={subtype} onChange={(e) => setSubtype(e.target.value)}>
            {SUBTYPES_BY_CATEGORY[category].map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label htmlFor="post-title">Title (5–100 characters)</label>
          <input id="post-title" type="text" minLength={5} maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field-group">
          <label htmlFor="post-description">Description (up to 2,000 characters)</label>
          <textarea id="post-description" rows={5} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
        <div className="field-group">
          <label htmlFor="post-location">Location (optional free text)</label>
          <input id="post-location" type="text" placeholder="e.g. Main Library 2nd Floor" value={locationText} onChange={(e) => setLocationText(e.target.value)} />
        </div>
        <div className="field-group">
          <label htmlFor="post-image">Optional image (JPEG or PNG, max 5 MB)</label>
          <input id="post-image" type="file" accept="image/jpeg,image/png" onChange={handleImageChange} />
        </div>
        {feedback && <p role="alert">{feedback}</p>}
        <div>
          <button type="submit" className="btn btn-primary">{isEditMode ? 'Save changes' : 'Publish post'}</button>
        </div>
      </form>
    </section>
  );
}