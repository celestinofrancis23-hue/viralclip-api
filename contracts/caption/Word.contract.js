// contracts/caption/Word.contract.js

function createWord({
  index,
  text,
  start,
  end,
  clipIndex,
}) {
  return {
    index,
    text,
    start,
    end,
    clipIndex,
  };
}

function validateWord(word) {
  if (!word || typeof word !== "object") {
    throw new Error("[Word.contract] Word inválido (não é objeto)");
  }

  if (!Number.isInteger(word.index)) {
    throw new Error("[Word.contract] Word precisa ter index inteiro");
  }

  if (typeof word.text !== "string" || !word.text.trim()) {
    throw new Error("[Word.contract] Word precisa ter text válido");
  }

  if (typeof word.start !== "number" || Number.isNaN(word.start)) {
    throw new Error("[Word.contract] Word start inválido");
  }

  if (typeof word.end !== "number" || Number.isNaN(word.end)) {
    throw new Error("[Word.contract] Word end inválido");
  }

  if (word.end < word.start) {
    throw new Error("[Word.contract] Word end não pode ser menor que start");
  }

  if (!Number.isInteger(word.clipIndex)) {
    throw new Error("[Word.contract] Word precisa ter clipIndex inteiro");
  }

  return word;
}

module.exports = {
  createWord,
  validateWord,
};
