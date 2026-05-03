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