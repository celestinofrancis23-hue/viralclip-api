// CaptionEngine/workers/render.worker.js
// Queima a legenda .ASS no vídeo via FFmpeg
// Usa o filtro ass= do FFmpeg que suporta estilos avançados

import { execFile } from “child_process”;
import { promisify } from “util”;
import path from “path”;
import fs from “fs”;

const execFileAsync = promisify(execFile);

/**

- @param {object} params
- @param {object} params.clip      - { clipIndex, videoPath }
- @param {string} params.assPath   - caminho do arquivo .ASS gerado
- @param {string} params.jobDir    - pasta de saída
- @returns {{ outputPath: string }}
  */
  export async function RenderWorker({ clip, assPath, jobDir }) {
  const outputPath = path.join(
  jobDir,
  `captioned_${clip.clipIndex}.mp4`
  );

// Escapa o caminho do ASS para o FFmpeg (Windows e Linux tratam diferente)
const escapedAssPath = escapeAssPath(assPath);

const args = [
“-y”,
“-i”, clip.videoPath,

```
// Filtro ass: queima as legendas com todos os estilos do arquivo .ASS
// O filtro subtitles= também funciona mas ass= preserva melhor os estilos
"-vf", `ass=${escapedAssPath}`,

// Codec de vídeo: re-encode necessário para queimar os subs
"-c:v", "libx264",
"-preset", "fast",
"-crf", "20",               // qualidade alta para clipes finais

// Codec de áudio: copia sem re-encode (mais rápido)
"-c:a", "copy",

// Otimização para web/streaming
"-movflags", "+faststart",

// Garante pixel format compatível
"-pix_fmt", "yuv420p",

outputPath,
```

];

console.log(`      🎨 Renderizando legenda no clipe ${clip.clipIndex}...`);

try {
const { stderr } = await execFileAsync(“ffmpeg”, args, {
timeout: 300000, // 5 min timeout
});

```
// FFmpeg escreve progresso no stderr — loga apenas erros reais
if (stderr && stderr.includes("Error")) {
  console.warn(`      ⚠️  FFmpeg warning: ${stderr.slice(-200)}`);
}
```

} catch (error) {
throw new Error(
`RenderWorker falhou no clipe ${clip.clipIndex}: ${error.message}`
);
}

if (!fs.existsSync(outputPath)) {
throw new Error(`RenderWorker: arquivo de saída não foi criado: ${outputPath}`);
}

const stats = fs.statSync(outputPath);
console.log(
`      ✅ Legenda queimada — ${(stats.size / 1024 / 1024).toFixed(1)}MB`
);

return { outputPath };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**

- Escapa o caminho do arquivo .ASS para uso no filtro FFmpeg
- FFmpeg exige escaping especial nos paths dos filtros -vf
  */
  function escapeAssPath(filePath) {
  // No Windows: substitui \ por / e escapa :
  // No Linux/Mac: escapa espaços e caracteres especiais
  return filePath
  .replace(/\/g, “/”)           // Windows backslash → forward slash
  .replace(/:/g, “\:”)          // escapa dois pontos (conflito com filtros FFmpeg)
  .replace(/’/g, “\’”)          // escapa aspas simples
  .replace(/ /g, “\ “);         // escapa espaços
  }
