module.exports = function CaptionBuilder({
  clips,
  transcriptSegments,
  jobDir
}) {
  if (!Array.isArray(clips) || !Array.isArray(transcriptSegments)) {
    throw new Error("[CaptionBuilder] clips ou transcriptSegments inválidos");
  }

  console.log("📝 [CaptionBuilder] Iniciando...");
  console.log("🎬 Clips:", clips.length);
  console.log("🗣️ Transcript segments:", transcriptSegments.length);

  const results = [];

  for (const clip of clips) {
    const { clipIndex, startTime, endTime } = clip;

    const captions = transcriptSegments
      .filter(seg =>
        seg.start >= startTime &&
        seg.end <= endTime &&
        seg.text &&
        seg.text.trim().length > 0
      )
      .map((seg, i) => ({
        i,
        start: Number((seg.start - startTime).toFixed(2)),
        end: Number((seg.end - startTime).toFixed(2)),
        text: seg.text.trim()
      }))
      .filter(cap => cap.end > cap.start);

    results.push({
      clipIndex,
      captions
    });

    console.log(`✅ Clip ${clipIndex}: ${captions.length} captions`);
  }

  console.log("✅ [CaptionBuilder] Finalizado");

  return { results };
};
