import axios from 'axios';
import FormData from 'form-data';

/**
 * Verify a resolution by comparing before and after images
 * @param {Buffer} beforeImageBuffer 
 * @param {Buffer} afterImageBuffer 
 * @returns {Promise<{verified: boolean, match_score: number, message: string}>}
 */
export const verifyResolutionWithAI = async (beforeImageBuffer, afterImageBuffer) => {
  try {
    const form = new FormData();
    form.append('before', beforeImageBuffer, { filename: 'before.jpg' });
    form.append('after', afterImageBuffer, { filename: 'after.jpg' });

    const response = await axios.post('http://127.0.0.1:8000/verify', form, {
      headers: {
        ...form.getHeaders()
      }
    });

    return response.data;
  } catch (error) {
    console.error('AI Verification Service Error:', error.response?.data || error.message);
    throw new Error('AI Verification failed to process images');
  }
};
