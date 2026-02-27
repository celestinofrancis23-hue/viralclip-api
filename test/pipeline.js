await captionBurnInWorker({
  videoPath: "/Users/celestinofrancisco/Desktop/viralclip-api/temp/e4c1256d-08ac-4793-a6e8-f3a522ee17c0/captioned/clip_0_captioned.mp4",
  outputPath: "clip_test.mp4",
  timeline: [
    { start: 1, end: 4, text: "TESTE DE LEGENDA" },
    { start: 5, end: 8, text: "FUNCIONA SIM" }
  ]
});
