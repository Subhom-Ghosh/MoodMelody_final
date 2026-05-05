import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
import mysql.connector
import bcrypt

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
    5. Rate the mood on a scale of 1 to 10 (1=Extremely Bad/Angry, 5=Neutral, 10=Extremely Happy/Excited).

    Format the response strictly as: Emotion | Activity | MusicVibe | HexColor | Score
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
        if len(parts) < 5:
            return {
                "emotion": parts[0].strip() if len(parts) > 0 else "Neutral",
                "activity": parts[1].strip() if len(parts) > 1 else "Take a deep breath and listen to the sounds around you.",
                "music": parts[2].strip() if len(parts) > 2 else "Ambient",
                "color": parts[3].strip() if len(parts) > 3 else "#F3A683",
                "score": 5
            }

        try:
            score = int(parts[4].strip())
        except ValueError:
            score = 5

        return {
            "emotion": parts[0].strip(),
            "activity": parts[1].strip(),
            "music": parts[2].strip(),
            "color": parts[3].strip(),
            "score": score
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
        print(f"Detailed Server Error: {str(e)}") 
        return {"success": False, "message": str(e)}
    

# ডাটাবেস কানেকশন ফাংশন
def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",      # আপনার MySQL ইউজারনেম
        password="root", # আপনার MySQL পাসওয়ার্ড
        database="MOODMELODYDB"
    )

# ডেটা মডেল
class UserAuth(BaseModel):
    username: str = None
    email: str
    password: str

# --- এপিআই এন্ডপয়েন্টস ---

@app.post("/signup")
async def signup(user: UserAuth):
    if len(user.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Password is too long (max 72 bytes)")
    db = get_db_connection()
    cursor = db.cursor()
    
    try:
        # ইউজার আগে থেকেই আছে কিনা চেক করা
        cursor.execute("SELECT * FROM users WHERE email = %s", (user.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Email already registered!")

        # পাসওয়ার্ড হ্যাশ করে ইনসার্ট করা
        hashed_password = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        query = "INSERT INTO users (username, email, password) VALUES (%s, %s, %s)"
        cursor.execute(query, (user.username, user.email, hashed_password))
        
        db.commit()
        return {"message": "Signup successful!"}
    
    except mysql.connector.Error as err:
        return {"detail": str(err)}
    finally:
        cursor.close()
        db.close()

@app.post("/login")
async def login(user: UserAuth):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True) # ডিকশনারি ফরমেটে ডাটা আসবে
    
    try:
        cursor.execute("SELECT * FROM users WHERE email = %s", (user.email,))
        db_user = cursor.fetchone()

        if not db_user:
            raise HTTPException(status_code=400, detail="User not found!")

        # পাসওয়ার্ড ভেরিফাই করা
        if not bcrypt.checkpw(user.password.encode("utf-8"), db_user['password'].encode("utf-8")):
            raise HTTPException(status_code=400, detail="Incorrect password!")

        return {
            "message": "Login successful!",
            "username": db_user['username']
        }
        
    finally:
        cursor.close()
        db.close()



@app.post("/save-mood")
async def save_mood(email: str, emotion: str, score: int = 5):
    db = get_db_connection()
    cursor = db.cursor()
    try:
        query = "INSERT INTO mood_history (user_email, emotion, score) VALUES (%s, %s, %s)"
        cursor.execute(query, (email, emotion, score))
        db.commit()
        return {"message": "Mood saved!"}
    except mysql.connector.Error as err:
        print(f"Database Error: {err}")
        raise HTTPException(status_code=400, detail=f"Database Error: {str(err)}")
    finally:
        cursor.close()
        db.close()

# সাপ্তাহিক স্ট্যাটাস পাওয়ার এন্ডপয়েন্ট
@app.get("/get-stats")
async def get_stats(email: str):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    try:
        # সর্বশেষ ৭টি মুড ডেটা আনা
        query = """
            SELECT id, created_at, score, emotion 
            FROM mood_history 
            WHERE user_email = %s 
            ORDER BY id DESC LIMIT 7
        """
        cursor.execute(query, (email,))
        results = cursor.fetchall()
        results.reverse() # ক্রমানুসারে দেখানোর জন্য উল্টে দেওয়া
        return results
    except mysql.connector.Error as err:
        raise HTTPException(status_code=400, detail=f"Database Error: {str(err)}")
    finally:
        cursor.close()
        db.close()