from flask import Flask, render_template, request, jsonify

import os

import requests
import base64
import json
import time
import re

app = Flask(__name__)

HF_API_KEY = "Your api key"  # Keep your existing API key

@app.route('/')
def index():
    """Render the main chat interface."""
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    """Process chat messages and return AI response."""
    data = request.json
    user_message = data.get('message', '')
    
    if not user_message:
        return jsonify({'error': 'No message provided'}), 400
    
    # Get AI response using the new model
    ai_response = get_model_response(user_message)
    
    # Get TTS audio from the response
    audio_data = get_tts_audio(ai_response)
    
    # Generate avatar animation (if using D-ID or similar)
    # avatar_url = generate_avatar_animation(ai_response, audio_data)
    
    return jsonify({
        'message': ai_response,
        'audio': audio_data
        # 'avatar': avatar_url  # If using D-ID or similar
    })

@app.route('/api/tts', methods=['POST'])
def tts():
    """Direct endpoint for text-to-speech conversion."""
    try:
        # Try to get JSON data
        data = request.json
        if data and 'text' in data:
            text = data.get('text', '')
        else:
            # If not JSON, check form data or raw request body
            text = request.form.get('text', '')
            
            # If still no text, try to read raw request body
            if not text and request.data:
                try:
                    body_data = json.loads(request.data.decode('utf-8'))
                    text = body_data.get('text', '')
                except:
                    # If we can't parse JSON, use the raw data as text
                    text = request.data.decode('utf-8')
        
        if not text:
            print("TTS endpoint received request with no text")
            return jsonify({'error': 'No text provided'}), 400
        
        print(f"Processing TTS request for text: {text[:50]}...")
        
        # Get TTS audio from the text
        audio_data = get_tts_audio(text)
        
        if audio_data:
            return jsonify({'audio': audio_data})
        else:
            return jsonify({'error': 'Failed to generate audio'}), 500
    except Exception as e:
        print(f"Error processing TTS request: {e}")
        return jsonify({'error': 'Invalid request format'}), 400


def get_model_response(message):
    """Get AI response from Mistral model."""
    API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2"
    headers = {"Authorization": f"Bearer {HF_API_KEY}"}

    # System prompt to guide the AI's tone and behavior
    system_prompt = """You are AI BUDDY, a helpful and friendly AI assistant. 
    Respond in a casual, warm, and conversational tone. Use friendly language, occasional humor, 
    and be supportive like a good friend would be. Keep responses relatively concise and upbeat.
    Avoid being overly formal or technical unless specifically asked for technical information."""

    # Construct the input payload
    payload = {
        "inputs": f"<s>[INST] {system_prompt}\n\nUser: {message} [/INST]"
    }

    try:
        # Send the request to the Hugging Face API
        response = requests.post(API_URL, headers=headers, json=payload)

        # Retry mechanism for rate-limiting or temporary failures
        retries = 0
        while response.status_code == 429 and retries < 3:
            print(f"Rate limited, retrying in 2 seconds (attempt {retries+1}/3)")
            time.sleep(2)
            response = requests.post(API_URL, headers=headers, json=payload)
            retries += 1

        # Handle non-200 responses
        if response.status_code != 200:
            print(f"Error response: {response.text}")
            return f"I'm having trouble connecting. Status code: {response.status_code}. Please try again later."

        # Debugging: Print the raw API response
        print(f"API Response: {response.text[:200]}...")

        # Process the response
        result = response.json()
        if isinstance(result, list) and len(result) > 0:
            # Extract the generated text
            response_text = result[0].get('generated_text', '')

            # Remove the system prompt and user input from the response
            if payload["inputs"] in response_text:
                response_text = response_text.replace(payload["inputs"], "").strip()

            # Clean up any unnecessary text (e.g., emoji descriptions or artifacts)
            response_text = re.sub(r':\w+:', '', response_text)  # Remove emoji descriptions
            response_text = response_text.strip()

            return response_text

        return "Sorry, I could not generate a response."
    except Exception as e:
        print(f"Error in model response: {e}")
        return "I'm having trouble understanding. Can you try again?"

def get_tts_audio(text):
    """Convert text to speech using Hugging Face TTS API with fallback options."""
    # Primary TTS model
    API_URL_PRIMARY = "https://api-inference.huggingface.co/models/espnet/kan-bayashi_ljspeech_vits"
# Fallback TTS model (a different model that might be more available)
    API_URL_FALLBACK = "https://api-inference.huggingface.co/models/microsoft/speecht5_tts"
    
    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    payload = {"inputs": text}
    
    # Function to try a specific TTS endpoint
    def try_tts_endpoint(api_url):
        try:
            max_retries = 3
            for attempt in range(max_retries):
                response = requests.post(api_url, headers=headers, json=payload)
                
                # The response should be audio data
                if response.status_code == 200:
                    # Convert binary audio data to base64 for embedding in HTML
                    audio_base64 = base64.b64encode(response.content).decode('utf-8')
                    return f"data:audio/wav;base64,{audio_base64}"
                elif response.status_code == 503:  # Service Unavailable
                    print(f"TTS API unavailable (503), retrying in 3 seconds (attempt {attempt+1}/{max_retries})")
                    time.sleep(3)
                elif "too busy" in response.text.lower() and attempt < max_retries - 1:
                    print(f"TTS model busy, retrying in 3 seconds (attempt {attempt+1}/{max_retries})")
                    time.sleep(3)
                else:
                    print(f"Error from TTS API: {response.text[:200]}...")
                    if attempt < max_retries - 1:
                        time.sleep(2)
                    else:
                        return None
            return None
        except Exception as e:
            print(f"Exception in TTS conversion: {e}")
            return None

    # Try primary endpoint
    print("Trying primary TTS model...")
    result = try_tts_endpoint(API_URL_PRIMARY)
    if result:
        return result
    
    # If primary fails, try fallback
    print("Primary TTS model failed, trying fallback model...")
    result = try_tts_endpoint(API_URL_FALLBACK)
    if result:
        return result
    
    # If both fail, try local TTS option if available
    try:
        import pyttsx3
        import tempfile
        print("Online TTS failed, using local TTS engine...")
        
        # Create a temporary file for the audio
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        temp_filename = temp_file.name
        temp_file.close()
        
        # Initialize the local TTS engine
        engine = pyttsx3.init()
        
        # Select a female voice
        voices = engine.getProperty('voices')
        for voice in voices:
            if "female" in voice.name.lower() or "zira" in voice.name.lower():
                engine.setProperty('voice', voice.id)
                print(f"Selected female voice: {voice.name}")
                break
        
        # Save the audio to a file
        engine.save_to_file(text, temp_filename)
        engine.runAndWait()
        
        # Read the file and convert to base64
        with open(temp_filename, 'rb') as audio_file:
            audio_data = audio_file.read()
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        # Clean up the temporary file
        os.unlink(temp_filename)
        
        return f"data:audio/wav;base64,{audio_base64}"
    except Exception as e:
        print(f"Local TTS failed: {e}")
        return None
    
if __name__ == '__main__':
    app.run(debug=True)