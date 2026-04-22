#!/usr/bin/env python3
"""
VAD Preprocessor — separa voz de música/silêncio em áudio de igreja.

Pipeline:
  1. Converte para mono 16kHz WAV (ideal para VAD e Whisper)
  2. Detecta segmentos de voz com silero-vad (torch) ou ffmpeg silencedetect
  3. Filtra música/aplausos (segmentos sem pausas internas ≥ 0.4s e > 45s)
  4. Funde pausas curtas (< 0.6s) entre segmentos de fala
  5. Concatena segmentos de voz num único ficheiro
  6. Grava JSON com mapeamento concat↔original para remapeamento de timestamps

Saída (stdout última linha):
  VAD_DONE total_voice=<float> segments=<int>

Saída (ficheiros):
  <output_dir>/voice_only.wav   — áudio com apenas voz
  <output_dir>/vad_segments.json — mapeamento de timestamps
"""

import sys
import os
import json
import subprocess
import struct
import wave
import re
import traceback

# ── Parâmetros de tuning ────────────────────────────────────────────────────
SILENCE_DB          = -38    # threshold de silêncio (dB) — mais baixo = mais sensível
MERGE_GAP_S         = 0.6    # fundir pausas < este valor (entre frases)
MIN_SEGMENT_S       = 2.0    # ignorar segmentos < este valor (ruído/tosse)
# Segmentos muito longos sem pausa interna ≥ MUSIC_PAUSE_THRESHOLD_S
# durante mais de MUSIC_MIN_DURATION_S são considerados música/ruído contínuo
MUSIC_MIN_DURATION_S    = 45.0
MUSIC_PAUSE_THRESHOLD_S = 0.4


def convert_to_wav16k(audio_path, output_dir):
    """Converte para mono 16kHz WAV."""
    wav_path = os.path.join(output_dir, "vad_input.wav")
    r = subprocess.run([
        "ffmpeg", "-y", "-i", audio_path,
        "-ac", "1", "-ar", "16000", "-vn",
        wav_path,
    ], capture_output=True, timeout=300)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg convert failed: {r.stderr.decode()[-500:]}")
    return wav_path


# ── Detecção com silero-vad (torch) ────────────────────────────────────────

def detect_with_silero(wav_path):
    """
    Usa silero-vad via torch.hub.
    Retorna lista de {start, end} em segundos.
    """
    import torch

    model, utils = torch.hub.load(
        repo_or_dir="snakers4/silero-vad",
        model="silero_vad",
        force_reload=False,
        onnx=True,          # mais leve que o modelo PyTorch completo
        verbose=False,
    )
    (get_speech_timestamps, _, read_audio, *_) = utils

    wav = read_audio(wav_path, sampling_rate=16000)

    timestamps = get_speech_timestamps(
        wav,
        model,
        sampling_rate=16000,
        threshold=0.40,             # probabilidade mínima de fala
        min_speech_duration_ms=500,
        min_silence_duration_ms=400,
        window_size_samples=512,
        speech_pad_ms=100,
        return_seconds=True,
    )

    return [{"start": float(t["start"]), "end": float(t["end"])} for t in timestamps]


# ── Detecção com ffmpeg silencedetect (fallback) ────────────────────────────

def detect_with_ffmpeg(wav_path):
    """
    Usa ffmpeg silencedetect para encontrar regiões de voz (inverso do silêncio).
    Retorna lista de {start, end} em segundos.
    """
    r = subprocess.run([
        "ffmpeg", "-i", wav_path,
        "-af", f"silencedetect=noise={SILENCE_DB}dB:d=0.3",
        "-f", "null", "-",
    ], capture_output=True, text=True, timeout=300)

    output = r.stderr

    # Duração total do ficheiro
    dur_match = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", output)
    total_dur = 0.0
    if dur_match:
        h, m, s = dur_match.groups()
        total_dur = int(h) * 3600 + int(m) * 60 + float(s)

    # Parsear silence_start e silence_end
    silence_starts = [float(x) for x in re.findall(r"silence_start:\s*([\d.]+)", output)]
    silence_ends   = [float(x) for x in re.findall(r"silence_end:\s*([\d.]+)", output)]

    # Construir regiões de voz (inverso das regiões de silêncio)
    silences = []
    for i, s in enumerate(silence_starts):
        e = silence_ends[i] if i < len(silence_ends) else total_dur
        silences.append((s, e))

    segments = []
    cursor = 0.0

    for (ss, se) in silences:
        if ss > cursor:
            segments.append({"start": cursor, "end": ss})
        cursor = se

    if cursor < total_dur - 0.1:
        segments.append({"start": cursor, "end": total_dur})

    return segments


# ── Pós-processamento ────────────────────────────────────────────────────────

def merge_close_segments(segments, gap_s):
    """Funde segmentos cuja separação é < gap_s."""
    if not segments:
        return []

    merged = [dict(segments[0])]

    for seg in segments[1:]:
        last = merged[-1]
        if seg["start"] - last["end"] < gap_s:
            last["end"] = max(last["end"], seg["end"])
        else:
            merged.append(dict(seg))

    return merged


def filter_music_segments(segments, wav_path):
    """
    Remove segmentos muito longos e contínuos (provávelmente música/hino).
    Um segmento é "música" se durar > MUSIC_MIN_DURATION_S e não tiver
    nenhuma pausa interna silenciosa detectável pelo ffmpeg.
    """
    filtered = []

    for seg in segments:
        duration = seg["end"] - seg["start"]

        if duration <= MUSIC_MIN_DURATION_S:
            filtered.append(seg)
            continue

        # Verificar se há pausas internas (fala tem pausas entre frases)
        r = subprocess.run([
            "ffmpeg",
            "-ss", str(seg["start"]),
            "-t", str(duration),
            "-i", wav_path,
            "-af", f"silencedetect=noise={SILENCE_DB}dB:d={MUSIC_PAUSE_THRESHOLD_S}",
            "-f", "null", "-",
        ], capture_output=True, text=True, timeout=60)

        pauses = re.findall(r"silence_start:", r.stderr)

        if len(pauses) >= 2:
            # Tem pausas internas → fala (pregação longa)
            filtered.append(seg)
        else:
            print(f"[VAD] ⚠ Segmento {seg['start']:.1f}s–{seg['end']:.1f}s ({duration:.0f}s) sem pausas → música/hino, ignorado")

    return filtered


def filter_short_segments(segments, min_s):
    return [s for s in segments if s["end"] - s["start"] >= min_s]


# ── Concatenar segmentos num único WAV ──────────────────────────────────────

def concatenate_segments(original_audio, segments, output_path):
    """
    Extrai cada segmento com ffmpeg e concatena num único WAV 16kHz mono.
    Devolve lista de segmentos com mapeamento concat↔original.
    """
    if not segments:
        return []

    tmp_files = []
    mapping   = []
    concat_t  = 0.0

    for i, seg in enumerate(segments):
        dur      = seg["end"] - seg["start"]
        tmp_path = output_path + f".part{i}.wav"

        r = subprocess.run([
            "ffmpeg", "-y",
            "-ss", str(seg["start"]),
            "-t", str(dur),
            "-i", original_audio,
            "-ac", "1", "-ar", "16000", "-vn",
            tmp_path,
        ], capture_output=True, timeout=120)

        if r.returncode != 0 or not os.path.exists(tmp_path):
            print(f"[VAD] ⚠ Falha ao extrair segmento {i}", file=sys.stderr)
            continue

        # Duração real do ficheiro extraído
        probe = subprocess.run([
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            tmp_path,
        ], capture_output=True, text=True, timeout=10)

        real_dur = float(probe.stdout.strip() or dur)

        mapping.append({
            "original_start": seg["start"],
            "original_end":   seg["end"],
            "concat_start":   concat_t,
            "concat_end":     concat_t + real_dur,
        })

        tmp_files.append(tmp_path)
        concat_t += real_dur

    if not tmp_files:
        return []

    # Criar lista para o filtro concat do ffmpeg
    list_path = output_path + ".list.txt"
    with open(list_path, "w") as f:
        for p in tmp_files:
            f.write(f"file '{p}'\n")

    subprocess.run([
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", list_path,
        "-c", "copy",
        output_path,
    ], capture_output=True, timeout=300, check=True)

    # Limpar ficheiros temporários
    for p in tmp_files:
        try: os.remove(p)
        except: pass
    try: os.remove(list_path)
    except: pass

    return mapping


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 3:
        print("Usage: vad_preprocessor.py <audio_path> <output_dir>", file=sys.stderr)
        sys.exit(1)

    audio_path = sys.argv[1]
    output_dir = sys.argv[2]
    os.makedirs(output_dir, exist_ok=True)

    print(f"[VAD] Áudio: {audio_path}")

    # 1. Converter para 16kHz mono
    wav_path = convert_to_wav16k(audio_path, output_dir)

    # 2. Detecção VAD
    segments = None
    method   = "unknown"

    try:
        segments = detect_with_silero(wav_path)
        method   = "silero-vad"
        print(f"[VAD] silero-vad: {len(segments)} segmentos brutos")
    except Exception as e:
        print(f"[VAD] silero-vad indisponível ({e.__class__.__name__}: {e}) — a usar ffmpeg", file=sys.stderr)

    if not segments:
        segments = detect_with_ffmpeg(wav_path)
        method   = "ffmpeg-silencedetect"
        print(f"[VAD] ffmpeg: {len(segments)} segmentos brutos")

    # 3. Fundir pausas curtas, filtrar curtos, filtrar música
    segments = merge_close_segments(segments, MERGE_GAP_S)
    segments = filter_short_segments(segments, MIN_SEGMENT_S)
    segments = filter_music_segments(segments, wav_path)
    segments = merge_close_segments(segments, MERGE_GAP_S)  # 2ª passagem após filtro música

    print(f"[VAD] {len(segments)} segmentos de voz após filtros ({method})")

    if not segments:
        print("[VAD] Nenhum segmento de voz detectado", file=sys.stderr)
        sys.exit(2)

    # 4. Concatenar voz
    voice_path = os.path.join(output_dir, "voice_only.wav")
    mapping    = concatenate_segments(wav_path, segments, voice_path)

    if not mapping:
        print("[VAD] Falha na concatenação", file=sys.stderr)
        sys.exit(3)

    total_voice = sum(m["concat_end"] - m["concat_start"] for m in mapping)

    # 5. Gravar JSON de mapeamento
    result = {
        "method":              method,
        "total_voice_duration": round(total_voice, 2),
        "segment_count":       len(mapping),
        "voice_audio_path":    voice_path,
        "segments":            mapping,
    }

    segments_path = os.path.join(output_dir, "vad_segments.json")
    with open(segments_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print(f"VAD_DONE total_voice={total_voice:.1f} segments={len(mapping)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[VAD] ERRO FATAL: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
