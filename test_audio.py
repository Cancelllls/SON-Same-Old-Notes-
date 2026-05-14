import torchaudio
import torch

print(f"Torchaudio version: {torchaudio.__version__}")
print(f"Available backends: {torchaudio.list_audio_backends()}")

try:
    # Just a dummy load to see if it crashes on import/setup
    # We don't have a real file here yet easily but we can check backends
    pass
except Exception as e:
    print(f"Error: {e}")
