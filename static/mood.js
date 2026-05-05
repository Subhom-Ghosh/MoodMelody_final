/**
 * MoodMelody - Core Logic (mood.js)
 * Handles: Authentication check, Mood Analysis, AI Chat, and Music Search
 */

// ১. ইউজার অথেনটিকেশন চেক
function checkAuth() {
    const username = localStorage.getItem('username');
    const userDisplay = document.getElementById('user-display');
    const userInitials = document.getElementById('user-initials');

    if (username) {
        if (userDisplay) userDisplay.innerText = `Welcome, ${username}!`;
        
        if (userInitials) {
            const names = username.trim().split(/\s+/);
            const firstLetter = names[0].charAt(0).toUpperCase();
            let secondLetter = "";
            
            if (names.length > 1) {
                // First letter of the second name
                secondLetter = names[1].charAt(0).toUpperCase();
            } else if (username.length > 1) {
                // Fallback if only one name is provided
                secondLetter = names[0].charAt(1).toUpperCase();
            }
            
            userInitials.innerText = firstLetter + secondLetter;
        }
    } else {
        // ইউজার লগইন না থাকলে auth.html পেজে পাঠিয়ে দেবে
        window.location.href = "auth.html";
    }
}

// স্ক্রিপ্ট যখন লোড হবে তখন সরাসরি চেক করবে 
checkAuth();

// ২. মুড অ্যানালাইসিস ফাংশন
async function analyzeMood() {
    const textInput = document.getElementById('userEmotion');
    const resultBox = document.getElementById('resultBox');
    const activityText = document.getElementById('activityText');
    const musicText = document.getElementById('musicText');
    const displayEmotion = document.getElementById('displayEmotion');
    const mainAppBox = document.getElementById('mainAppBox');
    const actionBtn = document.getElementById('actionBtn');

    if (!textInput.value.trim()) {
        alert("Please tell me how you feel first!");
        return;
    }

    actionBtn.innerText = "Analyzing...";
    actionBtn.disabled = true;

    try {
        const response = await fetch('http://127.0.0.1:8000/analyze-mood', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: textInput.value })
        });

        if (!response.ok) throw new Error("Server Error");

        const data = await response.json();

        // UI আপডেট
        displayEmotion.innerText = `Feeling ${data.emotion}?`;
        activityText.innerText = `"${data.activity}"`;
        musicText.innerText = data.music;

        // ডাইনামিক থিম পরিবর্তন
        mainAppBox.style.borderColor = data.color;
        mainAppBox.style.boxShadow = `0 20px 50px ${data.color}66`;

        resultBox.classList.remove('hidden');

        // analyzeMood ফাংশনের সাকসেস ব্লকের ভেতরে এটি যোগ করুন
        const userEmail = localStorage.getItem('email') || localStorage.getItem('userEmail');
        if (userEmail) {
            fetch(`http://127.0.0.1:8000/save-mood?email=${userEmail}&emotion=${encodeURIComponent(data.emotion)}&score=${data.score || 5}`, {
                method: 'POST'
            }).catch(err => console.error("Failed to save mood:", err));
        }

    } catch (error) {
        console.error("Error:", error);
        alert("Make sure your FastAPI server is running.");
    } finally {
        actionBtn.innerText = "Get Activity";
        actionBtn.disabled = false;
    }
}

// ৩. চ্যাট বক্স লজিক
async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const messagesDiv = document.getElementById('chatMessages');
    const msg = input.value.trim();

    if (!msg) return;

    // ইউজারের মেসেজ অ্যাড করা
    messagesDiv.innerHTML += `<div class="bg-white/10 p-3 rounded-2xl self-end ml-auto max-w-[80%] shadow-sm text-white mb-2"> ${msg} </div>`;
    input.value = '';

    // টাইপিং ইন্ডিকেটর
    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'typing';
    typingIndicator.className = 'bg-rose-500/20 p-3 rounded-2xl self-start max-w-[80%] italic text-xs text-rose-300 mb-2';
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

        const indicator = document.getElementById('typing');
        if (indicator) indicator.remove();

        messagesDiv.innerHTML += `<div class="bg-rose-600/30 p-3 rounded-2xl self-start max-w-[80%] shadow-sm text-white mb-2"> ${data.reply} </div>`;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

    } catch (error) {
        const indicator = document.getElementById('typing');
        if (indicator) indicator.innerText = "Connection lost. Try again.";
    }
}

// ৪. মিউজিক সার্চ ফাংশন (Saavn Integration)
async function getSpotifySong() {
    const input = document.getElementById('userEmotion'); // মুড ইনপুট থেকে সার্চ হবে
    const btn = document.getElementById('actionBtn');

    try {
        const moodRes = await fetch('http://127.0.0.1:8000/analyze-mood', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input.value })
        });
        const moodData = await moodRes.json();

        // Saavn API কল করা
        const musicRes = await fetch(`http://127.0.0.1:8000/get-saavn-song?query=${encodeURIComponent(moodData.music)}`);
        const musicData = await musicRes.json();

        if (musicData.success) {
            console.log("Song found:", musicData.song_name);
            // এখানে প্লেয়ার আপডেট কোড যোগ করুন
            // document.getElementById('audioPlayer').src = musicData.audio_url;
        } else {
            console.warn("Music search failed: " + musicData.message);
        }
    } catch (error) {
        console.error("Music Error:", error);
    }
}

// ৫. আবির/পার্টিকেল ইফেক্ট
document.addEventListener("mousemove", function (e) {
    // পারফরম্যান্সের জন্য এখানে ৩টির বদলে ২পি করা হয়েছে
    for (let i = 0; i < 2; i++) {
        let abir = document.createElement("div");
        abir.className = "abir";
        abir.style.position = "absolute";
        abir.style.width = "5px";
        abir.style.height = "5px";
        abir.style.borderRadius = "50%";
        abir.style.pointerEvents = "none";
        abir.style.zIndex = "999";

        abir.style.left = `${e.pageX}px`;
        abir.style.top = `${e.pageY}px`;

        let colors = ["#4285F4", "#EA4335", "#34A853", "#FBBC05", "#E91E63"];
        abir.style.background = colors[Math.floor(Math.random() * colors.length)];

        abir.style.setProperty("--x", Math.random() * 2 - 1);
        abir.style.setProperty("--y", Math.random() * 2 - 1);

        document.body.appendChild(abir);

        // ১ সেকেন্ড পর রিমুভ হবে
        setTimeout(() => abir.remove(), 1000);
    }
});


async function toggleStats() {
    const statsSection = document.getElementById('statsSection');

    if (statsSection.classList.contains('hidden') || statsSection.style.display === 'none') {
        statsSection.classList.remove('hidden');
        statsSection.style.display = 'flex'; // Force display to overcome CSS conflicts
        // পপআপ ওপেন হওয়ার সাথে সাথে চার্ট রেন্ডার হবে
        await renderMoodChart();
    } else {
        statsSection.classList.add('hidden');
        statsSection.style.display = 'none';
    }
}

// Chart.js ইন্সট্যান্স ট্র্যাকিং ভেরিয়েবল
let moodChartInstance = null;

async function renderMoodChart() {
    const userEmail = localStorage.getItem('email') || localStorage.getItem('userEmail');

    if (!userEmail) {
        alert("Please login first to view stats.");
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:8000/get-stats?email=${userEmail}`);
        if (!response.ok) throw new Error("Failed to fetch stats");

        const stats = await response.json();
        console.log("Stats Data:", stats);

        // যদি ডাটাবেসে কোনো ডেটা না থাকে
        if (!Array.isArray(stats) || stats.length === 0) {
            alert("No mood stats found! Try analyzing your mood first.");
            return;
        }

        // চার্টের জন্য ডেটা ফরম্যাট করা
        const labels = stats.map(stat => new Date(stat.created_at).toLocaleDateString());
        const dataPoints = stats.map(stat => stat.score);

        const ctx = document.getElementById('moodChart').getContext('2d');

        // যদি আগের চার্ট থাকে, সেটি মুছে ফেলা যাতে ওভারল্যাপ না হয়
        if (moodChartInstance) {
            moodChartInstance.destroy();
        }

        // নতুন চার্ট তৈরি
        moodChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Mood Score',
                    data: dataPoints,
                    borderColor: '#e11d48', // Rose 600
                    backgroundColor: 'rgba(225, 29, 72, 0.2)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch (error) {
        console.error("Error rendering chart:", error);
    }
}

// ---------------------------------
// Profile Menu & Settings Functions
// ---------------------------------

function toggleProfileMenu() {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
        dropdown.classList.toggle('flex');
    }
}

// Close dropdown if clicked outside
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('profileDropdown');
    const userInitials = document.getElementById('user-initials');
    if (dropdown && !dropdown.classList.contains('hidden')) {
        if (!userInitials.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.classList.add('hidden');
            dropdown.classList.remove('flex');
        }
    }
});

function logoutUser() {
    localStorage.removeItem('username');
    localStorage.removeItem('email');
    localStorage.removeItem('userEmail');
    window.location.href = "auth.html";
}

function openSettings() {
    const settingsModal = document.getElementById('settingsModal');
    const dropdown = document.getElementById('profileDropdown');
    
    // Hide dropdown
    if (dropdown) {
        dropdown.classList.add('hidden');
        dropdown.classList.remove('flex');
    }
    
    // Show Modal
    if (settingsModal) {
        settingsModal.classList.remove('hidden');
        settingsModal.classList.add('flex'); // Add flex to center
        
        // Populate email
        const emailField = document.getElementById('settings-email');
        if (emailField) {
            const userEmail = localStorage.getItem('email') || localStorage.getItem('userEmail');
            emailField.innerText = userEmail ? userEmail : "No email found";
        }
        
        // Update Dark Mode toggle visual state
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.checked = localStorage.getItem('darkMode') === 'enabled';
        }
    }
}

function closeSettings() {
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
        settingsModal.classList.add('hidden');
        settingsModal.classList.remove('flex');
    }
}

function toggleDarkMode() {
    const toggle = document.getElementById('darkModeToggle');
    if (toggle.checked) {
        document.body.classList.add('dark-theme');
        localStorage.setItem('darkMode', 'enabled');
    } else {
        document.body.classList.remove('dark-theme');
        localStorage.setItem('darkMode', 'disabled');
    }
}

// Initialize Dark Mode on page load
document.addEventListener('DOMContentLoaded', () => {
    const darkModeState = localStorage.getItem('darkMode');
    if (darkModeState === 'enabled') {
        document.body.classList.add('dark-theme');
    }
});