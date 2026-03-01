FROM node:22-bookworm-slim

# ===============================
# Instala dependências do sistema
# ===============================
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    ca-certificates \
    curl \
    libgomp1 \
    libstdc++6 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Garante python3 como padrão
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Atualiza pip
RUN python3 -m pip install --upgrade pip

# ===============================
# Instala yt-dlp
# ===============================
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# ===============================
# Instala faster-whisper + deps
# ===============================
RUN pip3 install --no-cache-dir --break-system-packages faster-whisper

WORKDIR /app

# ===============================
# Instala dependências Node
# ===============================
COPY package*.json ./
RUN npm install --ignore-scripts

# Copia restante do projeto
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
