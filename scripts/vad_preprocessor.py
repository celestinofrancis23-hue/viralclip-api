#!/usr/bin/env python3
"""
VAD Preprocessor v2 — detecta pregação vs música em cultos de igreja.

Pipeline:
  1. Converte para mono 16kHz WAV
  2. VAD inicial: silero-vad (torch) ou ffmpeg silencedetect
  3. Merge coarse (gap 3s) → blocos grandes para classificação
  4. Classifica cada bloco por taxa de pausas/min:
       - speech : ≥ 4 pausas/min (frases naturais de pregação)
       - music  : < 2 pausas/min (audio sustentado — hino/louvor)
       - ambiguous: 2-4 pausas/min (anúncios, oração)
  5. Filtra por duração: pregação dura > MIN_PREACHING_S
  6. Re-merge speech (gap 0.6s) → segmentos finais para Whisper
  7. Concatena e grava JSON com mapeamento concat↔original

Saída (stdout última linha):
  VAD_DONE total_voice=<float> segments=<int>
"""

import sys
import os
import json
import subprocess
import re
import traceback
import statistics

# ── Parâmetros de tuning ─────────────────────────────────────────────────────

SILENCE_DB              = -38    # threshold de silêncio (dB)
COARSE_MERGE_GAP_S      = 3.0   # gap para blocos de classificação (entre versículos/frases longas)
FINE_MERGE_GAP_S        = 0.6   # gap para merge final (entre frases curtas)
MIN_SEGMENT_S           = 1.5   # ignorar segmentos muito curtos (tosse/ruído)

# Classificação por taxa de pausas internas (pausas ≥ 0.3s)
SPEECH_PAUSE_RATE_MIN   = 4.0   # pausas/min — acima disto = pregação
MUSIC_PAUSE_RATE_MAX    = 2.0   # pausas/min — abaixo disto = música
# Entre 2 e 4 = ambíguo (anúncios, oração, testemunhos curtos)

PAUSE_ANALYSIS_DUR_S    = 0.3   # duração mínima de pausa para contar
REGULAR_PAUSE_STD_MAX   = 1.2   # std das pausas — baixo = ritmo regular = música

# Filtro de duração: pregação dura muito mais que música
MIN_PREACHING_BLOCK_S   = 8 * 60   # 8 min — blocos de pregação contínua
MIN_KEEP_SPEECH_S       = 3 * 60   # 3 min — mínimo para qualquer bloco de fala
# Nota: blocos ambíguos < MIN_KEEP_SPEECH_S são descartados
#        blocos ambíguos ≥ MIN_KEEP_SPEECH_S são mantidos (podem ser oração/testemunho)

# Agrupamento de blocos de pregação
PREACHING_GROUP_GAP_S   = 90    # seg — gap máximo entre blocos de pregação do mesmo sermão


# ─────────────────────────────────────────────────────────────────────────────
#  Conversão de áudio
# ─────────────────────────────────────────────────────────────────────────────

def convert_to_wav16k(audio_path, output_dir):
    wav_path = os.path.join(output_dir, "vad_input.wav")
    r = subprocess.run([
        "ffmpeg", "-y", "-i", audio_path,
        "-ac", "1", "-ar", "16000", "-vn",
        wav_path,
    ], capture_output=True, timeout=300)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg convert failed: {r.stderr.decode()[-500:]}")
    return wav_path


def get_total_duration(wav_path):
    r = subprocess.run([
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        wav_path,
    ], capture_output=True, text=True, timeout=15)
    try:
        return float(r.stdout.strip())
    except:
        return 0.0


# ─────────────────────────────────────────────────────────────────────────────
#  VAD inicial
# ─────────────────────────────────────────────────────────────────────────────

def detect_with_silero(wav_path):
    import torch
    model, utils = torch.hub.load(
        repo_or_dir="snakers4/silero-vad",
        model="silero_vad",
        force_reload=False,
        onnx=True,
        verbose=False,
    )
    (get_speech_timestamps, _, read_audio, *_) = utils
    wav = read_audio(wav_path, sampling_rate=16000)
    timestamps = get_speech_timestamps(
        wav, model,
        sampling_rate=16000,
        threshold=0.40,
        min_speech_duration_ms=500,
        min_silence_duration_ms=300,
        window_size_samples=512,
        speech_pad_ms=100,
        return_seconds=True,
    )
    return [{"start": float(t["start"]), "end": float(t["end"])} for t in timestamps]


def detect_with_ffmpeg(wav_path, total_dur):
    r = subprocess.run([
        "ffmpeg", "-i", wav_path,
        "-af", f"silencedetect=noise={SILENCE_DB}dB:d=0.3",
        "-f", "null", "-",
    ], capture_output=True, text=True, timeout=300)
    output = r.stderr

    silence_starts = [float(x) for x in re.findall(r"silence_start:\s*([\d.]+)", output)]
    silence_ends   = [float(x) for x in re.findall(r"silence_end:\s*([\d.]+)", output)]

    silences = []
    for i, s in enumerate(silence_starts):
        e = silence_ends[i] if i < len(silence_ends) else total_dur
        silences.append((s, e))

    segments = []
    cursor = 0.0
    for (ss, se) in silences:
        if ss > cursor + 0.1:
            segments.append({"start": cursor, "end": ss})
        cursor = se
    if cursor < total_dur - 0.1:
        segments.append({"start": cursor, "end": total_dur})
    return segments


# ─────────────────────────────────────────────────────────────────────────────
#  Merge
# ─────────────────────────────────────────────────────────────────────────────

def merge_close_segments(segments, gap_s):
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


def filter_short_segments(segments, min_s):
    return [s for s in segments if s["end"] - s["start"] >= min_s]


# ─────────────────────────────────────────────────────────────────────────────
#  Análise de pausas — coração do classificador
# ─────────────────────────────────────────────────────────────────────────────

def analyze_pauses(wav_path, start, duration):
    """
    Conta pausas de ≥ PAUSE_ANALYSIS_DUR_S dentro do segmento.
    Retorna dict com métricas.
    """
    if duration < 5.0:
        return {"n_pauses": 0, "pause_rate": 0.0, "pause_std": 0.0, "pause_density": 0.0}

    r = subprocess.run([
        "ffmpeg",
        "-ss", f"{start:.3f}",
        "-t",  f"{duration:.3f}",
        "-i", wav_path,
        "-af", f"silencedetect=noise={SILENCE_DB}dB:d={PAUSE_ANALYSIS_DUR_S}",
        "-f", "null", "-",
    ], capture_output=True, text=True, timeout=max(60, int(duration * 0.1)))

    output = r.stderr
    pause_starts  = [float(x) for x in re.findall(r"silence_start:\s*([\d.]+)", output)]
    pause_ends    = [float(x) for x in re.findall(r"silence_end:\s*([\d.]+)", output)]
    pause_durs    = []

    for i, ps in enumerate(pause_starts):
        pe = pause_ends[i] if i < len(pause_ends) else (start + duration)
        pause_durs.append(pe - ps)

    n_pauses   = len(pause_starts)
    pause_rate = n_pauses / (duration / 60.0)  # pausas por minuto

    # Regularidade das pausas: baixo std = ritmo regular = música
    if len(pause_starts) >= 3:
        intervals = [pause_starts[i+1] - pause_starts[i] for i in range(len(pause_starts)-1)]
        try:
            pause_std = statistics.stdev(intervals)
        except:
            pause_std = 0.0
    else:
        pause_std = 0.0

    # Densidade de pausa: % do tempo em silêncio
    total_pause_time = sum(pause_durs)
    pause_density    = total_pause_time / duration if duration > 0 else 0.0

    return {
        "n_pauses":      n_pauses,
        "pause_rate":    round(pause_rate, 2),
        "pause_std":     round(pause_std, 2),
        "pause_density": round(pause_density, 3),
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Classificação de blocos
# ─────────────────────────────────────────────────────────────────────────────

def classify_block(metrics, duration):
    """
    Classifica um bloco como 'speech', 'music' ou 'ambiguous'.

    Regras:
      - music  : pause_rate < MUSIC_PAUSE_RATE_MAX
                 OU (pause_rate baixa E pausas muito regulares)
      - speech : pause_rate ≥ SPEECH_PAUSE_RATE_MIN (frases naturais)
      - ambiguous: zona cinzenta (oração, anúncios, testemunhos)
    """
    pr  = metrics["pause_rate"]
    std = metrics["pause_std"]
    n   = metrics["n_pauses"]

    # Audio muito curto — inclassificável
    if duration < 5.0:
        return "noise"

    # Música: muito poucas pausas (audio sustentado — hino/instrumento)
    if pr < MUSIC_PAUSE_RATE_MAX:
        return "music"

    # Música: pausas regulares como batida (std baixo = metrónomo)
    if pr < 6.0 and std < REGULAR_PAUSE_STD_MAX and n >= 3:
        return "music"

    # Pregação: muitas pausas irregulares (frases naturais)
    if pr >= SPEECH_PAUSE_RATE_MIN:
        return "speech"

    # Zona cinzenta
    return "ambiguous"


# ─────────────────────────────────────────────────────────────────────────────
#  Classificar e filtrar todos os blocos
# ─────────────────────────────────────────────────────────────────────────────

def classify_and_filter(coarse_blocks, wav_path):
    """
    Analisa cada bloco coarse, classifica, e decide o que manter.
    Retorna lista de blocos aprovados + relatório de log.
    """
    classified = []

    print(f"\n[VAD] ── Análise de {len(coarse_blocks)} blocos ─────────────────────")
    print(f"[VAD] {'Início':>8}  {'Fim':>8}  {'Dur':>6}  {'Pausas/min':>10}  {'Std':>5}  {'Class':<10}")
    print(f"[VAD] {'':─<8}  {'':─<8}  {'':─<6}  {'':─<10}  {'':─<5}  {'':─<10}")

    for blk in coarse_blocks:
        dur     = blk["end"] - blk["start"]
        metrics = analyze_pauses(wav_path, blk["start"], dur)
        label   = classify_block(metrics, dur)

        note = ""
        # Filtro de duração pós-classificação
        if label == "speech" and dur < MIN_KEEP_SPEECH_S:
            note = "(curto — descartado)"
            label = "discard"
        elif label == "ambiguous" and dur < MIN_KEEP_SPEECH_S:
            note = "(ambíguo curto — descartado)"
            label = "discard"
        elif label == "ambiguous":
            note = "(ambíguo — mantido)"

        ts_start = fmt_time(blk["start"])
        ts_end   = fmt_time(blk["end"])
        print(f"[VAD] {ts_start:>8}  {ts_end:>8}  {dur:>5.0f}s  {metrics['pause_rate']:>10.1f}  {metrics['pause_std']:>5.1f}  {label:<10}  {note}")

        classified.append({**blk, "label": label, "duration": dur, "metrics": metrics})

    print(f"[VAD] ──────────────────────────────────────────────────────────────\n")

    # Manter apenas speech e ambiguous (não descartado)
    kept = [b for b in classified if b["label"] in ("speech", "ambiguous")]

    # Agrupar blocos de pregação próximos (podem ter música curta entre eles)
    # e descartar grupos muito pequenos
    kept = group_and_filter_by_duration(kept)

    return kept


def group_and_filter_by_duration(blocks):
    """
    Agrupa blocos de fala próximos (gap < PREACHING_GROUP_GAP_S) em grupos.
    Mantém grupos cujo total de duração de fala é ≥ MIN_KEEP_SPEECH_S.
    """
    if not blocks:
        return []

    # Criar grupos
    groups = []
    current_group = [blocks[0]]

    for blk in blocks[1:]:
        gap = blk["start"] - current_group[-1]["end"]
        if gap <= PREACHING_GROUP_GAP_S:
            current_group.append(blk)
        else:
            groups.append(current_group)
            current_group = [blk]
    groups.append(current_group)

    result = []
    print(f"[VAD] ── Grupos de fala ───────────────────────────────────────────")
    for i, group in enumerate(groups):
        total_dur   = sum(b["duration"] for b in group)
        group_start = fmt_time(group[0]["start"])
        group_end   = fmt_time(group[-1]["end"])
        n_blocks    = len(group)

        if total_dur >= MIN_PREACHING_BLOCK_S:
            status = "✅ PREGAÇÃO"
            result.extend(group)
        elif total_dur >= MIN_KEEP_SPEECH_S:
            status = "⚠ FALA (oração/anúncio)"
            result.extend(group)
        else:
            status = "❌ descartado (curto)"

        print(f"[VAD]   Grupo {i+1}: {group_start}–{group_end}  {total_dur:.0f}s  {n_blocks} blocos  {status}")

    print(f"[VAD] ──────────────────────────────────────────────────────────────\n")
    return result


def fmt_time(seconds):
    """Formata segundos como HH:MM:SS."""
    s = int(seconds)
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


# ─────────────────────────────────────────────────────────────────────────────
#  Concatenar segmentos num único WAV
# ─────────────────────────────────────────────────────────────────────────────

def concatenate_segments(wav_path, segments, output_path):
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
            "-ss", f"{seg['start']:.3f}",
            "-t",  f"{dur:.3f}",
            "-i", wav_path,
            "-ac", "1", "-ar", "16000", "-vn",
            tmp_path,
        ], capture_output=True, timeout=120)

        if r.returncode != 0 or not os.path.exists(tmp_path):
            print(f"[VAD] ⚠ Falha ao extrair segmento {i}", file=sys.stderr)
            continue

        probe = subprocess.run([
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            tmp_path,
        ], capture_output=True, text=True, timeout=10)

        real_dur = float(probe.stdout.strip() or dur)

        mapping.append({
            "original_start": round(seg["start"], 3),
            "original_end":   round(seg["end"], 3),
            "concat_start":   round(concat_t, 3),
            "concat_end":     round(concat_t + real_dur, 3),
            "label":          seg.get("label", "speech"),
        })

        tmp_files.append(tmp_path)
        concat_t += real_dur

    if not tmp_files:
        return []

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

    for p in tmp_files:
        try: os.remove(p)
        except: pass
    try: os.remove(list_path)
    except: pass

    return mapping


# ─────────────────────────────────────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 3:
        print("Usage: vad_preprocessor.py <audio_path> <output_dir>", file=sys.stderr)
        sys.exit(1)

    audio_path = sys.argv[1]
    output_dir = sys.argv[2]
    os.makedirs(output_dir, exist_ok=True)

    print(f"[VAD] ═══════════════════════════════════════════════════════════════")
    print(f"[VAD] Áudio: {audio_path}")

    # 1. Converter para 16kHz mono
    wav_path   = convert_to_wav16k(audio_path, output_dir)
    total_dur  = get_total_duration(wav_path)
    print(f"[VAD] Duração total: {fmt_time(total_dur)} ({total_dur:.0f}s)")

    # 2. VAD inicial — segmentos brutos (pequenos)
    raw_segments = None
    method       = "unknown"

    try:
        raw_segments = detect_with_silero(wav_path)
        method = "silero-vad"
        print(f"[VAD] silero-vad: {len(raw_segments)} segmentos brutos")
    except Exception as e:
        print(f"[VAD] silero-vad indisponível ({e.__class__.__name__}) — ffmpeg", file=sys.stderr)

    if not raw_segments:
        raw_segments = detect_with_ffmpeg(wav_path, total_dur)
        method = "ffmpeg-silencedetect"
        print(f"[VAD] ffmpeg: {len(raw_segments)} segmentos brutos")

    # 3. Merge coarse (3s gap) → blocos grandes para classificação
    coarse = merge_close_segments(raw_segments, COARSE_MERGE_GAP_S)
    coarse = filter_short_segments(coarse, MIN_SEGMENT_S)
    print(f"[VAD] {len(coarse)} blocos coarse após merge {COARSE_MERGE_GAP_S}s")

    # 4. Classificar e filtrar blocos (speech / music / ambiguous)
    speech_blocks = classify_and_filter(coarse, wav_path)

    if not speech_blocks:
        print("[VAD] ❌ Nenhum segmento de fala/pregação detectado", file=sys.stderr)
        sys.exit(2)

    # 5. Re-merge fine (0.6s gap) → segmentos finais suaves para Whisper
    final_segments = []
    for blk in speech_blocks:
        # Cada bloco aprovado: usar os segmentos raw internos (gap 0.6s)
        raw_in_block = [
            s for s in raw_segments
            if s["start"] >= blk["start"] - 0.1 and s["end"] <= blk["end"] + 0.1
        ]
        if raw_in_block:
            fine = merge_close_segments(raw_in_block, FINE_MERGE_GAP_S)
            fine = filter_short_segments(fine, 1.0)
            for seg in fine:
                seg["label"] = blk.get("label", "speech")
            final_segments.extend(fine)
        else:
            # Fallback: usar o bloco inteiro
            speech_blocks_copy = dict(blk)
            speech_blocks_copy["label"] = blk.get("label", "speech")
            final_segments.append(speech_blocks_copy)

    final_segments.sort(key=lambda s: s["start"])

    print(f"[VAD] {len(final_segments)} segmentos finais para Whisper:")
    total_speech = sum(s["end"] - s["start"] for s in final_segments)
    for seg in final_segments:
        dur = seg["end"] - seg["start"]
        print(f"[VAD]   {fmt_time(seg['start'])}–{fmt_time(seg['end'])}  ({dur:.0f}s)  [{seg.get('label','?')}]")

    print(f"[VAD] Total voz: {fmt_time(total_speech)} ({total_speech:.0f}s) de {fmt_time(total_dur)}")

    # 6. Concatenar
    voice_path = os.path.join(output_dir, "voice_only.wav")
    mapping    = concatenate_segments(wav_path, final_segments, voice_path)

    if not mapping:
        print("[VAD] Falha na concatenação", file=sys.stderr)
        sys.exit(3)

    total_voice = sum(m["concat_end"] - m["concat_start"] for m in mapping)

    # 7. Gravar JSON
    result = {
        "method":               method,
        "total_duration":       round(total_dur, 2),
        "total_voice_duration": round(total_voice, 2),
        "speech_ratio":         round(total_voice / total_dur, 3) if total_dur > 0 else 0,
        "segment_count":        len(mapping),
        "voice_audio_path":     voice_path,
        "segments":             mapping,
    }

    segments_path = os.path.join(output_dir, "vad_segments.json")
    with open(segments_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print(f"\n[VAD] ═══════════════════════════════════════════════════════════════")
    print(f"VAD_DONE total_voice={total_voice:.1f} segments={len(mapping)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[VAD] ERRO FATAL: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
