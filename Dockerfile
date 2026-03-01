FROM node:22-bookworm-slim

# Instala dependências do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instala yt-dlp globalmente
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# Instala faster-whisper e dependências
RUN pip3 install --no-cache-dir faster-whisper

WORKDIR /app

# Instala dependências Node primeiro (cache eficiente)
COPY package*.json ./
RUN npm install --ignore-scripts

# Copia o resto do código
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
