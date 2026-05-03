async function analyzeMood() {
    const textInput = document.getElementById('userEmotion');
    const resultBox = document.getElementById('resultBox');
    const activityText = document.getElementById('activityText');
    const musicText = document.getElementById('musicText');
    const displayEmotion = document.getElementById('displayEmotion');
    const mainAppBox = document.getElementById('mainAppBox');
    const actionBtn = document.getElementById('actionBtn');

    // Input check
    if (!textInput.value.trim()) {
        alert("Please tell me how you feel first!");
        return;
    }

    // 1. Loading State
    actionBtn.innerText = "Analyzing...";
    actionBtn.disabled = true;
    actionBtn.classList.add('opacity-50', 'cursor-not-allowed');

    try {
        // 2. FastAPI Backend connection
        const response = await fetch('http://127.0.0.1:8000/analyze-mood', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: textInput.value })
        });

        if (!response.ok) throw new Error("Server Error");

        const data = await response.json();

        // 3. Update the UI with AI data
        displayEmotion.innerText = `Feeling ${data.emotion}?`;
        activityText.innerText = `"${data.activity}"`;
        musicText.innerText = data.music;
        
        // 4. Dynamic Theme Change
        // mainAppBox-er border ebong shadow change hobe AI-er dewa color onujayi
        mainAppBox.style.borderColor = data.color;
        mainAppBox.style.boxShadow = `0 20px 50px ${data.color}66`; // 66 adds some transparency
        
        // Show result box
        resultBox.classList.remove('hidden');

    } catch (error) {
        console.error("Error:", error);
        alert("Make sure your FastAPI server is running on http://127.0.0.1:8000");
    } finally {
        // Reset button state
        actionBtn.innerText = "Get Activity";
        actionBtn.disabled = false;
        actionBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

//CHAT BOX


async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const messagesDiv = document.getElementById('chatMessages');
    const msg = input.value.trim();

    if (!msg) return;

    
    messagesDiv.innerHTML += `<div class="bg-white/70 p-3 rounded-2xl self-end ml-auto max-w-[80%] shadow-sm"> ${msg} </div>`;
    input.value = '';
    
    
    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'typing';
    typingIndicator.className = 'bg-rose-100 p-3 rounded-2xl self-start max-w-[80%] italic text-xs text-rose-400';
    typingIndicator.innerText = "MoodMelody is thinking...";
    messagesDiv.appendChild(typingIndicator);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    try {
        const response = await fetch('http://127.0.0.1:8000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        });

        const data = await response.json();

        // ৩. "Typing..." সরিয়ে আসল উত্তর দেখানো
        document.getElementById('typing').remove();
        messagesDiv.innerHTML += `<div class="bg-rose-200/80 p-3 rounded-2xl self-start max-w-[80%] shadow-sm"> ${data.reply} </div>`;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

    } catch (error) {
        document.getElementById('typing').innerText = "Connection lost. Try again.";
    }
}


// mood.js এর ভেতরে
async function getSpotifySong() { // নিশ্চিত করুন এখানে async আছে
    const input = document.getElementById('moodInput');
    const btn = document.getElementById('findBtn');

    if (!input.value.trim()) return alert("Please enter your mood!");

    btn.innerText = "Finding your song...";
    
    try {
        // ১. মুড অ্যানালাইসিস কল করা
        const moodRes = await fetch('http://127.0.0.1:8000/analyze-mood', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input.value })
        });
        const moodData = await moodRes.json();

        // ২. Saavn API এর জন্য আপনার পাইথন এন্ডপয়েন্ট কল করা
        const musicRes = await fetch(`http://127.0.0.1:8000/get-saavn-song?query=${encodeURIComponent(moodData.music)}`);
        const musicData = await musicRes.json();

        if (musicData.success) {
            // প্লেয়ার আপডেট লজিক এখানে হবে
            console.log("Song found:", musicData.song_name);
            // উদাহরণ: document.getElementById('spotifyPlayer').src = musicData.audio_url;
        } else {
            alert("Music search failed: " + musicData.message);
        }

    } catch (error) {
        console.error("Error details:", error);
    } finally {
        btn.innerText = "Find My Vibe";
    }
}