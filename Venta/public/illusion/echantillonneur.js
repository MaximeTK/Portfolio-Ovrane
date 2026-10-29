// Processeur audio de RUBY, servi tel quel : il ramène le son à 16 kHz en moyennant et rend des paquets de 100 ms en entiers 16 bits
const FREQUENCE_FLUX = 16000;

class Echantillonneur extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pas = sampleRate / FREQUENCE_FLUX;
    this.somme = 0; this.compte = 0; this.position = 0; this.rempli = 0;
    this.paquet = new Int16Array(FREQUENCE_FLUX / 10);
  }

  process(entrees) {
    const canal = entrees[0] && entrees[0][0];
    if (!canal) return true;
    for (let i = 0; i < canal.length; i++) {
      this.somme += canal[i]; this.compte += 1; this.position += 1;
      if (this.position < this.pas) continue;
      this.position -= this.pas;
      const v = Math.max(-1, Math.min(1, this.somme / this.compte));
      this.paquet[this.rempli++] = v < 0 ? v * 0x8000 : v * 0x7fff;
      this.somme = 0; this.compte = 0;
      if (this.rempli === this.paquet.length) {
        this.port.postMessage(this.paquet.buffer, [this.paquet.buffer]);
        this.paquet = new Int16Array(FREQUENCE_FLUX / 10);
        this.rempli = 0;
      }
    }
    return true;
  }
}

registerProcessor('echantillonneur', Echantillonneur);
