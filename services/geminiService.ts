
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateMarketingStrategy = async (
  topic: string, 
  audience: string, 
  tone: string
): Promise<string> => {
  try {
    const prompt = `
      Act as a world-class creative director. 
      I need 5 distinct marketing hooks/angles for the following context:
      Topic/Product: ${topic}
      Target Audience: ${audience}
      Tone: ${tone}

      Format the output as a clean HTML list (<ul><li>...</li></ul>) without markdown backticks. 
      Keep each hook punchy and under 20 words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate strategy. Please try again.";
  }
};
