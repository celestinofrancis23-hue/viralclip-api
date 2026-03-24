FROM node:22-bookworm-slim

# ===============================
# Dependências do sistema
# ===============================
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
    ffmpeg \
    ca-certificates \
    curl \
    libgomp1 \
    libstdc++6 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# ===============================
# Cria ambiente virtual Python
# ===============================
RUN python3 -m venv /opt/venv

# Ativa venv no PATH
ENV PATH="/opt/venv/bin:$PATH"

# Atualiza pip
RUN pip install --upgrade pip

# ===============================
# 🔥 Instala dependências Python
# ===============================
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# ===============================
# Node
# ===============================
WORKDIR /app

COPY package*.json ./
RUN npm install --ignore-scripts

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
