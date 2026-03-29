// services/claude.service.js
import Anthropic from '@anthropic-ai/sdk';

// Khởi tạo Anthropic client với API key từ biến môi trường
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

/**
 * Gửi prompt hoặc messages tới Claude AI.
 * @param {string|Array<{role: string, content: string}>} input - prompt string hoặc mảng messages.
 * @returns {Promise<string>} - Chỉ trả về phần text của Claude.
 */
export async function askClaude(input) {
  try {
    // Nếu input là string, chuyển thành messages array
    const messages = Array.isArray(input)
      ? input
      : [{ role: 'user', content: input }];

    // Gọi API Anthropic với model Haiku
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages,
    });

    // Trả về phần text trả lời
    return response.content?.[0]?.text || '';
  } catch (error) {
    // Ghi log lỗi và ném lỗi để xử lý ở tầng trên
    console.error('Claude API error:', error);
    throw new Error('Claude API request failed');
  }
}
