// workers/ASSGeneratorWorker.js

module.exports = async function ASSGeneratorWorker({ layouts }) {
  return layouts.map(l =>
    `Dialogue: 0,${l.start},${l.end},Default,,0,0,0,,${l.activeWordIndex}`
  ).join('\n');
};
