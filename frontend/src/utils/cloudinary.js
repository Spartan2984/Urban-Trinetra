import { api } from '../api/client';

export const uploadToCloudinary = async (file) => {
  try {
    // 1. Get signature from backend
    const { data } = await api.get('/complaints/upload-signature');
    const { signature, timestamp, cloudName, apiKey } = data.data;

    // 2. Upload to Cloudinary
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message || 'Cloudinary upload failed');
    }

    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
      signature: result.signature
    };
  } catch (error) {
    console.error('Upload Error:', error);
    throw new Error('Failed to upload image. Make sure Cloudinary credentials are correct.');
  }
};
