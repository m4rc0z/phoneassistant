from gtts import gTTS
from pydub import AudioSegment
import os

def generate_16khz_wav(text, filename="test_audio_16khz.wav"):
    """
    Generates a WAV file with the given text at a 16kHz sample rate.
    """
    # Create a temporary MP3 file from gTTS
    temp_mp3_file = "temp_audio.mp3"
    tts = gTTS(text=text, lang='en')
    tts.save(temp_mp3_file)

    # Load the MP3, set sample rate to 16kHz, and export as WAV
    audio = AudioSegment.from_mp3(temp_mp3_file)
    audio = audio.set_frame_rate(16000)
    # Set to mono
    audio = audio.set_channels(1)
    audio.export(filename, format="wav")

    # Clean up the temporary MP3 file
    os.remove(temp_mp3_file)
    print(f"Generated '{filename}' with text: '{text}' at 16kHz sample rate.")

if __name__ == "__main__":
    generate_16khz_wav("Hello, this is a test for speech recognition at 16 kilohertz.")
