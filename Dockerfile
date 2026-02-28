FROM node:22-bookworm-slim

# Instala dependências do sistema (python3 + ffmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  python3-pip \
  ffmpeg \
  ca-certificates \
  curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependências primeiro
COPY package*.json ./
RUN npm install --ignore-scripts

# Copia o resto do código
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
