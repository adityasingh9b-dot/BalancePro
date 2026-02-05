
import { GoogleGenAI, Type } from "@google/genai";

export async function generateWorkoutTip(theme: string = "Fitness") {
  // Fix: Initializing GoogleGenAI inside the call to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a short, high-energy motivational tip for a ${theme} class. Maximum 20 words.`,
      config: {
        temperature: 0.8,
        topP: 0.9,
      }
    });
    return response.text || "Push your limits today!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Stay focused, stay strong!";
  }
}
