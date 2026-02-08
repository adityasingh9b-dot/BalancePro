import * as GoogleGenerativeAI from "@google/generative-ai";

export async function generateWorkoutTip(theme: string = "Fitness") {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI.GoogleGenAI(apiKey || "");
  
  try {
    // Official SDK syntax: getGenerativeModel
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    
    const prompt = `Act as Coach Nitesh (hardcore Indian gym coach). Generate a short, high-energy motivational tip in Hinglish for a ${theme} class. Maximum 15 words.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || "Chal beta, ek rep aur! Push your limits!";
    
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Focus bana ke rakh, mehnat rang layegi!";
  }
}
