import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai

# Load environment variables from .env file
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError("CRITICAL ERROR: GEMINI_API_KEY not found in .env file.")

# Initialize FastAPI app
app = FastAPI(title="MoodMelody API")

# Enable CORS (Required for your HTML/Frontend to communicate with this API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace "*" with your actual domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Gemini Client
client = genai.Client(api_key=API_KEY)

# Request Model
class MoodRequest(BaseModel):
    text: str

@app.get("/")
async def root():
    return {"message": "MoodMelody AI Server is Running!"}

@app.get("/models")
async def get_available_models():
    try:
        models = client.models.list()
        return {"models_you_can_use": [m.name for m in models]}
    except Exception as e:
        return {"error": str(e)}

@app.post("/analyze-mood")
async def analyze_mood(request: MoodRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Please provide some text.")

    prompt = f"""
    The user says: "{request.text}"
    Act as an empathetic mood companion. 
    1. Identify the core emotion. if user did not give any emotion means write anything beyond emotion, tell them to give emotion first
    2. Suggest a small, uplifting activity (max 12 words).
    3. Suggest a specific indian music with artist name according to the mood.
    4. Provide a Hex Color code that represents this mood.

    Format the response strictly as: Emotion | Activity | MusicVibe | HexColor
    """

    try:
        # Dynamically fetch available models for your API key to avoid 404 errors
        available_models = []
        for m in client.models.list():
            if "gemini" in m.name and "embedding" not in m.name:
                clean_name = m.name.replace("models/", "")
                available_models.append(clean_name)
                
        if not available_models:
            raise ValueError("No Gemini models are available for this API key.")
            
        # Prioritize 'flash' models for speed, otherwise take the first available
        chosen_model = next((m for m in available_models if "flash" in m), available_models[0])
        print(f"Automatically selected model: {chosen_model}")

        response = client.models.generate_content(
            model=chosen_model, 
            contents=prompt
        )

        # Check if response has text
        if not response.text:
            raise ValueError("AI returned an empty response")

        parts = response.text.strip().split('|')

        # Fallback logic if AI doesn't follow the '|' format perfectly
        if len(parts) < 4:
            return {
                "emotion": "Neutral",
                "activity": "Take a deep breath and listen to the sounds around you.",
                "music": "Ambient",
                "color": "#F3A683"
            }

        return {
            "emotion": parts[0].strip(),
            "activity": parts[1].strip(),
            "music": parts[2].strip(),
            "color": parts[3].strip()
        }

    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        # If gemini-1.5-flash fails, try gemini-1.5-pro as a fallback
        raise HTTPException(status_code=500, detail=f"API Error: {str(e)}")
    


class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
async def chat_with_ai(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Empty message")

    try:
        
        available_models = [m.name.replace("models/", "") for m in client.models.list() 
                            if "gemini" in m.name and "embedding" not in m.name]
        
        
        chosen_model = next((m for m in available_models if "flash" in m), available_models[0])
        
        response = client.models.generate_content(
            model=chosen_model, 
            contents=f"Act as MoodMelody AI, a supportive  companion. Keep your tone empathetic and friendly. User says: {request.message}"
        )
        
        if not response.text:
            return {"reply": "I'm here, but I couldn't process that. Can you try again?"}

        return {"reply": response.text}

    except Exception as e:
        print(f"Detailed Chat Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    

import spotipy
from spotipy.oauth2 import SpotifyClientCredentials

# Spotify Credentials (Spotify Developer Dashboard থেকে নিতে হবে)
SPOTIPY_CLIENT_ID = 'your_client_id'
SPOTIPY_CLIENT_SECRET = 'your_client_secret'

sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(client_id=SPOTIPY_CLIENT_ID,
                                                           client_secret=SPOTIPY_CLIENT_SECRET))

# main.py তে এই নতুন এন্ডপয়েন্টটি যোগ করুন

@app.get("/get-saavn-song")
async def get_saavn_song(query: str):
    import httpx
    import re
    
    try:
        # কোয়েরি থেকে স্পেশাল ক্যারেক্টার ক্লিন করা (যাতে API সহজে খুঁজে পায়)
        clean_query = re.sub(r'[^\w\s]', '', query) 
        # Using saavn.me as a reliable alternative since saavn.dev is down
        search_url = f"https://saavn.me/search/songs?query={clean_query}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(search_url, timeout=10.0)
            
            # যদি Saavn API এরর দেয়
            if response.status_code != 200:
                print(f"Saavn API returned status: {response.status_code}")
                return {"success": False, "message": "External API error"}

            try:
                data = response.json()
            except ValueError:
                print(f"Non-JSON response received: {response.text[:200]}")
                return {"success": False, "message": "Music API returned an invalid response (API might be down)"}
            
            # রেজাল্ট চেক করা
            if data.get("success") and data.get("data") and len(data["data"]["results"]) > 0:
                track = data["data"]["results"][0]
                
                return {
                    "success": True,
                    "song_name": track["name"],
                    "artist": track["artists"]["primary"][0]["name"],
                    "audio_url": track["downloadUrl"][-1]["url"], 
                    "image_url": track["image"][-1]["url"]
                }
            
            return {"success": False, "message": "No song found"}
            
    except Exception as e:
        print(f"Detailed Server Error: {str(e)}") # এটি আপনার টার্মিনালে এরর দেখাবে
        return {"success": False, "message": str(e)}