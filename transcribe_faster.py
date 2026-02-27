from faster_whisper import WhisperModel
import sys
import json

audio_path = sys.argv[1]
output_path = sys.argv[2]

print("🎙️ faster-whisper iniciado (Apple Silicon)")

model = WhisperModel(
    "small",
    device="auto",
    compute_type="int8"  # ✅ CORRETO PARA M4
)

segments, info = model.transcribe(audio_path)

result = {
    "language": info.language,
    "segments": []
}

for s in segments:
    result["segments"].append({
        "start": s.start,
        "end": s.end,
        "text": s.text.strip()
    })

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print("✅ Transcrição concluída com faster-whisper")
