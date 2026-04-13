#!/usr/bin/env python3
"""
detect_faces.py — detecção de rostos frame a frame via MediaPipe
Uso: python detect_faces.py <frames_dir> <fps> <video_width> <video_height>
Output: JSON para stdout — lista de {time, faces:[{x,y,w,h,confidence}]}
"""

import sys
import os
import json
import cv2
import mediapipe as mp


def detect_faces(frames_dir, fps, video_width, video_height):
    mp_face = mp.solutions.face_detection

    results = []
    frames = sorted([f for f in os.listdir(frames_dir) if f.endswith(".jpg")])

    with mp_face.FaceDetection(
        model_selection=1,          # modelo full-range (melhor para busto/corpo inteiro)
        min_detection_confidence=0.4
    ) as detector:
        for idx, frame_file in enumerate(frames):
            frame_path = os.path.join(frames_dir, frame_file)
            img = cv2.imread(frame_path)

            if img is None:
                continue

            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            detection = detector.process(img_rgb)

            time_sec = round(idx / fps, 3)
            faces = []

            if detection.detections:
                for det in detection.detections:
                    bb = det.location_data.relative_bounding_box

                    # clamp para [0, 1]
                    x = max(0.0, min(1.0, bb.xmin))
                    y = max(0.0, min(1.0, bb.ymin))
                    w = max(0.0, min(1.0 - x, bb.width))
                    h = max(0.0, min(1.0 - y, bb.height))

                    faces.append({
                        "x": round(x, 4),
                        "y": round(y, 4),
                        "w": round(w, 4),
                        "h": round(h, 4),
                        "confidence": round(float(det.score[0]), 3)
                    })

            results.append({
                "time": time_sec,
                "frame": frame_file,
                "faces": faces
            })

    return results


if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Uso: detect_faces.py <frames_dir> <fps> <video_width> <video_height>", file=sys.stderr)
        sys.exit(1)

    frames_dir   = sys.argv[1]
    fps          = float(sys.argv[2])
    video_width  = int(sys.argv[3])
    video_height = int(sys.argv[4])

    data = detect_faces(frames_dir, fps, video_width, video_height)
    print(json.dumps(data))
