import sys
import json
import cv2
import os

video_path = sys.argv[1]
sample_rate = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5

if not os.path.exists(video_path):
    print(json.dumps({ "error": "Video file not found", "path": video_path }))
    sys.exit(1)

cap = cv2.VideoCapture(video_path)
if not cap.isOpened():
    print(json.dumps({ "error": "Could not open video", "path": video_path }))
    sys.exit(1)

fps = cap.get(cv2.CAP_PROP_FPS)

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

frames = []
frame_index = 0
sample_every = max(1, int(fps * sample_rate))

while True:
    ret, frame = cap.read()
    if not ret:
        break

    if frame_index % sample_every == 0:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces_detected = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(60, 60)
        )

        faces = []
        for (x, y, w, h) in faces_detected:
            faces.append({
                "x": int(x),
                "y": int(y),
                "w": int(w),
                "h": int(h),
                "confidence": 1.0
            })

        frames.append({
            "time": round(frame_index / fps, 2),
            "faces": faces
        })

    frame_index += 1

cap.release()

print(json.dumps({ "frames": frames }))
